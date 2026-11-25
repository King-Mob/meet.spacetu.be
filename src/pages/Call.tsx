import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParticipantTile } from '../components/ParticipantTile';
import { useLiveKitRoom } from '../hooks/useLiveKitRoom';

export default function Call() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const name = sessionStorage.getItem('meetjohn-name') || 'guest';

  const {
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
  } = useLiveKitRoom({
    displayName: name,
    autoConnect: true,
    autoEnableCamera: true,
    autoEnableMicrophone: true,
  });

  const leave = useCallback(async () => {
    await disconnect();
    navigate('/');
  }, [disconnect, navigate]);

  // Invite link is the site root; guests just type a name and land in the room.
  const copyInvite = async () => {
    await navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isErrored = status.startsWith('error:');

  // Safety: if sessionStorage was cleared (fresh tab on /call), go back to lobby.
  useEffect(() => {
    if (!sessionStorage.getItem('meetjohn-name')) navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="page call">
      <header>
        <div className="brand">
          MeetJohn <span className={`dot ${connected ? 'live' : ''}`} />
        </div>
        <div className="status">
          {status}
          {isErrored && (
            <button type="button" onClick={connect}>
              retry
            </button>
          )}
        </div>
        <button type="button" onClick={copyInvite}>
          {copied ? '✓ link copied' : 'copy invite link'}
        </button>
      </header>

      <main>
        <div className="grid">
          {Array.from(tiles.values()).map((tile) => (
            <ParticipantTile key={tile.identity} {...tile} />
          ))}
        </div>
        {connecting && <p className="hint center">connecting to the call…</p>}
        {!connecting && tiles.size === 1 && connected && (
          <p className="hint center">you're the only one here — send them the invite link!</p>
        )}
      </main>

      <footer>
        <button type="button" className={micEnabled ? '' : 'danger'} disabled={!connected} onClick={toggleMic}>
          {micEnabled ? '🎙 mute' : '🔇 unmute'}
        </button>
        <button type="button" className={camEnabled ? '' : 'danger'} disabled={!connected} onClick={toggleCam}>
          {camEnabled ? '📷 stop video' : '🚫 start video'}
        </button>
        <button type="button" className={sharingScreen ? 'primary' : ''} disabled={!connected} onClick={toggleScreenShare}>
          {sharingScreen ? '🖥 stop sharing' : '🖥 share screen'}
        </button>
        <button type="button" className="danger" onClick={leave}>
          ← leave
        </button>
      </footer>
    </div>
  );
}
