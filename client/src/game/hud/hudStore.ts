// Bridge between the game loop and React. The engine publishes a HUD summary ~15 times per second; the store
// keeps the previous reference of every field whose content did not change, so a component that selects a
// few fields only re-renders when those fields really change.
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { HudState } from './hudState';

interface HudStore {
  hud: HudState | null;
}

export const hudStore = create<HudStore>(() => ({ hud: null }));

const same = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  // Small arrays and records (players, loadout, flags, marks): compare by content
  return JSON.stringify(a) === JSON.stringify(b);
};

/** Keeps the old value of every unchanged field (and the old object if nothing changed at all). */
export function mergeStable(prev: HudState | null, next: HudState): HudState {
  if (!prev) return next;
  let changed = false;
  const out = { ...next };
  for (const key of Object.keys(next) as (keyof HudState)[]) {
    if (same(prev[key], next[key])) (out as Record<string, unknown>)[key] = prev[key];
    else changed = true;
  }
  return changed ? out : prev;
}

export function publishHud(next: HudState): void {
  const prev = hudStore.getState().hud;
  const merged = mergeStable(prev, next);
  if (merged !== prev) hudStore.setState({ hud: merged });
}

export function resetHud(): void {
  hudStore.setState({ hud: null });
}

/** Selects a few HUD fields; the component re-renders only when one of them changes. */
export function useHud<T>(select: (hud: HudState) => T): T | undefined {
  return hudStore(useShallow((s: HudStore) => (s.hud ? select(s.hud) : undefined)));
}

/** Whether the engine has published anything yet. */
export const useHudReady = (): boolean => hudStore((s) => s.hud !== null);
