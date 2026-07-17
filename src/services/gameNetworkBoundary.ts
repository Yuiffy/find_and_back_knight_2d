import type { PlayerProfile, RaidResult } from '../types/game';

export type GameDomainEvent =
  | { type: 'raid.started'; raidId: number; mapId: string; entryId: string; at: string }
  | { type: 'raid.settled'; raidId: number; mapId: string; result: RaidResult; at: string }
  | { type: 'profile.saved'; profileVersion: number; updatedAt: string };

export interface ProfileGateway {
  loadProfile(): Promise<PlayerProfile>;
  saveProfile(profile: PlayerProfile): Promise<PlayerProfile>;
  settleRaid(raidId: number, result: RaidResult): Promise<PlayerProfile>;
}

const eventTarget = new EventTarget();

export function publishDomainEvent(event: GameDomainEvent): void {
  eventTarget.dispatchEvent(new CustomEvent<GameDomainEvent>('game-domain-event', { detail: event }));
}

export function subscribeToDomainEvents(listener: (event: GameDomainEvent) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<GameDomainEvent>).detail);
  eventTarget.addEventListener('game-domain-event', handler);
  return () => eventTarget.removeEventListener('game-domain-event', handler);
}

// Future multiplayer/profile servers implement ProfileGateway and consume the same
// stable domain events. Phaser objects and render state never cross this boundary.
