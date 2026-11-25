export const LK_URL = 'wss://project-133bpm-s6d3ajm5.livekit.cloud';

// One personal meeting at a time, so the room name is fixed.
export const ROOM_NAME = 'meetjohn';

export function randomIdentity(): string {
  return Math.random().toString(36).slice(2, 10);
}
