// Observer: the engine announces what happens; audio (and anything else) listens without the engine
// knowing about it.
import type { FlagEventType, WeaponId } from '@blockshot/shared';

export interface GameEventMap {
  jump: undefined;
  /** fall speed (m/s, negative) */
  land: { fall: number };
  slide: undefined;
  step: { volume: number };
  pad: undefined;
  shot: { weapon: WeaponId | null; volume: number };
  reload: undefined;
  hit: { head: boolean; kill: boolean };
  hurt: undefined;
  streak: undefined;
  tag: { confirm: boolean };
  flag: { type: FlagEventType };
}

type EventName = keyof GameEventMap;
type Payload<K extends EventName> = GameEventMap[K] extends undefined ? [] : [GameEventMap[K]];

export class EventBus {
  private readonly listeners = new Map<EventName, Set<(payload: never) => void>>();

  on<K extends EventName>(event: K, fn: (payload: GameEventMap[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }

  emit<K extends EventName>(event: K, ...payload: Payload<K>): void {
    for (const fn of this.listeners.get(event) ?? []) (fn as (p: GameEventMap[K] | undefined) => void)(payload[0]);
  }
}
