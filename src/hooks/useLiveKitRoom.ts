import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { Participant, RemoteParticipant, RemoteTrack, TrackPublication } from 'livekit-client';
import { LK_URL, ROOM_NAME, randomIdentity } from '../lib/config';
import type { TileState } from '../types';

export interface UseLiveKitRoomOptions {
  /** Display name shown to other participants. */
  displayName: string;
  /** Connect as soon as the hook mounts. */
  autoConnect?: boolean;
  /** Enable camera the moment the room connects. */
  autoEnableCamera?: boolean;
  /** Enable microphone the moment the room connects. */
  autoEnableMicrophone?: boolean;
}

// Split a track publication into the right TileState fields. Camera and
// screen share are kept apart so a participant can show both at once.
function trackFields(pub: TrackPublication): Partial<TileState> {
  const track = pub.track;
  if (!track) return {};
  if (pub.source === Track.Source.ScreenShare) return { screenTrack: track };
  if (track.kind === Track.Kind.Video) return { videoTrack: track };
  return { audioTrack: track };
}

function clearFields(pub: TrackPublication): Partial<TileState> {
  if (pub.source === Track.Source.ScreenShare) return { screenTrack: undefined, sharingScreen: false };
  if (pub.kind === Track.Kind.Video) return { videoTrack: undefined };
  return { audioTrack: undefined };
}

export function useLiveKitRoom(options: UseLiveKitRoomOptions) {
  const { displayName, autoConnect, autoEnableCamera, autoEnableMicrophone } = options;

  const [status, setStatus] = useState('not connected');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [tiles, setTiles] = useState<Map<string, TileState>>(new Map());

  // The Room object is created synchronously in connect() and stored here so
  // an unmount mid-connect can always abort it — otherwise a cancelled mount
  // would leak a ghost participant into the room.
  const roomRef = useRef<Room | null>(null);
  const localIdentityRef = useRef<string | null>(null);
  const autoConnectedRef = useRef(false);

  const upsertTile = useCallback((identity: string, updater: (tile: TileState) => TileState) => {
    setTiles((prev) => {
      const next = new Map(prev);
      const existing =
        next.get(identity) ??
        ({
          identity,
          label: identity,
          isLocal: identity === localIdentityRef.current,
          speaking: false,
          micEnabled: true,
          camEnabled: true,
          sharingScreen: false,
        } satisfies TileState);
      next.set(identity, updater(existing));
      return next;
    });
  }, []);

  const connect = useCallback(async () => {
    if (roomRef.current) return; // already connecting/connected
    setConnecting(true);
    const identity = randomIdentity();
    localIdentityRef.current = identity;

    // Created before any await: the unmount cleanup can then always reach it.

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    try {
      const params = new URLSearchParams({ room: ROOM_NAME, identity, name: displayName });
      const tokenRes = await fetch(`/api/token?${params.toString()}`);
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error ?? 'failed to get token');
      }
      const { token } = await tokenRes.json();

      room.on(RoomEvent.TrackSubscribed, (_track: RemoteTrack, pub, participant: RemoteParticipant) => {
        upsertTile(participant.identity, (tile) => ({
          ...tile,
          label: participant.name || participant.identity,
          ...trackFields(pub),
        }));
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        upsertTile(participant.identity, (tile) => ({
          ...tile,
          label: participant.name || participant.identity,
        }));
      });

      room.on(RoomEvent.TrackUnsubscribed, (_track: RemoteTrack, pub, participant: RemoteParticipant) => {
        upsertTile(participant.identity, (tile) => ({ ...tile, ...clearFields(pub) }));
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        setTiles((prev) => {
          const next = new Map(prev);
          next.delete(participant.identity);
          return next;
        });
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speakingIds = new Set(speakers.map((p) => p.identity));
        setTiles((prev) => {
          const next = new Map(prev);
          next.forEach((tile, id) => next.set(id, { ...tile, speaking: speakingIds.has(id) }));
          return next;
        });
      });

      room.on(RoomEvent.LocalTrackPublished, (pub: TrackPublication) => {
        upsertTile(identity, (tile) => ({
          ...tile,
          ...trackFields(pub),
          ...(pub.source === Track.Source.ScreenShare ? { sharingScreen: true } : {}),
        }));
        if (pub.source === Track.Source.ScreenShare) setSharingScreen(true);
      });

      room.on(RoomEvent.LocalTrackUnpublished, (pub: TrackPublication) => {
        upsertTile(identity, (tile) => ({ ...tile, ...clearFields(pub) }));
        if (pub.source === Track.Source.ScreenShare) setSharingScreen(false);
      });

      room.on(RoomEvent.TrackMuted, (pub: TrackPublication, participant: Participant) => {
        if (pub.kind === Track.Kind.Audio) {
          upsertTile(participant.identity, (tile) => ({ ...tile, micEnabled: false }));
        } else if (pub.kind === Track.Kind.Video) {
          upsertTile(participant.identity, (tile) => ({ ...tile, camEnabled: false }));
        }
      });

      room.on(RoomEvent.TrackUnmuted, (pub: TrackPublication, participant: Participant) => {
        if (pub.kind === Track.Kind.Audio) {
          upsertTile(participant.identity, (tile) => ({ ...tile, micEnabled: true }));
        } else if (pub.kind === Track.Kind.Video) {
          upsertTile(participant.identity, (tile) => ({ ...tile, camEnabled: true }));
        }
      });

      room.on(RoomEvent.TrackUnpublished, (pub: TrackPublication, participant: RemoteParticipant) => {
        upsertTile(participant.identity, (tile) => ({ ...tile, ...clearFields(pub) }));
      });

      room.on(RoomEvent.Disconnected, () => {
        // Only tear down state if THIS room is still the active one — a newer
        // connect() may already own roomRef after a reconnect.
        if (roomRef.current !== room) return;
        setStatus('disconnected');
        setConnected(false);
        setConnecting(false);
        setMicEnabled(false);
        setCamEnabled(false);
        setSharingScreen(false);
        setTiles(new Map());
        roomRef.current = null;
      });

      setStatus('connecting…');
      await room.connect(LK_URL, token);
      if (roomRef.current !== room) return; // aborted while connecting
      setStatus(`connected to "${ROOM_NAME}"`);
      setConnected(true);

      if (autoEnableCamera || autoEnableMicrophone) {
        upsertTile(identity, (tile) => ({ ...tile, label: displayName, isLocal: true }));
      }

      // A denied device must not fail the join — degrade to a note instead.
      if (autoEnableCamera) {
        try {
          await room.localParticipant.setCameraEnabled(true);
          setCamEnabled(true);
        } catch {
          setStatus('connected — camera unavailable (permission denied?)');
        }
      }
      if (autoEnableMicrophone) {
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          setMicEnabled(true);
        } catch {
          setStatus('connected — microphone unavailable (permission denied?)');
        }
      }

      // pick up anyone already in the room
      room.remoteParticipants.forEach((participant) => {
        upsertTile(participant.identity, (tile) => ({
          ...tile,
          label: participant.name || participant.identity,
        }));
        participant.trackPublications.forEach((pub) => {
          upsertTile(participant.identity, (tile) => ({ ...tile, ...trackFields(pub) }));
        });
      });
    } catch (err) {
      setStatus(`error: ${(err as Error).message}`);
      if (roomRef.current === room) {
        roomRef.current = null;
      }
    } finally {
      setConnecting(false);
    }
  }, [displayName, autoEnableCamera, autoEnableMicrophone, upsertTile]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    setMicEnabled(!enabled);
  }, []);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);
    setCamEnabled(!enabled);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isScreenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(!enabled, { audio: true });
    // tile + flag updates arrive via LocalTrackPublished/Unpublished
  }, []);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    await room?.disconnect();
  }, []);

  // auto-connect once per mounted instance; StrictMode's double-invoke is
  // handled by the roomRef guard + synchronous room creation above
  useEffect(() => {
    if (!autoConnect) return;
    if (autoConnectedRef.current) return;
    autoConnectedRef.current = true;
    connect();
    return () => {
      autoConnectedRef.current = false;
    };
  }, [autoConnect, connect]);

  // let go of camera/mic + socket on unmount (also aborts an in-flight connect)
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  return {
    status,
    connected,
    connecting,
    micEnabled,
    camEnabled,
    sharingScreen,
    tiles,
    connect,
    disconnect,
    toggleMic,
    toggleCam,
    toggleScreenShare,
  };
}
