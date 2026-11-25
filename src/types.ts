import type { Track } from 'livekit-client';

export interface TileState {
  identity: string;
  label: string;
  isLocal: boolean;
  speaking: boolean;
  micEnabled: boolean;
  camEnabled: boolean;
  sharingScreen: boolean;
  videoTrack?: Track;
  screenTrack?: Track;
  audioTrack?: Track;
}

export interface TokenResponse {
  token: string;
}
