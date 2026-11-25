export const LK_URL = 'wss://meet-spacetu-be-kuqjyaay.livekit.cloud';

// One personal meeting at a time, so the room name is fixed.
export const ROOM_NAME = 'meetjohn';

export function randomIdentity(): string {
  return Math.random().toString(36).slice(2, 10);
}
