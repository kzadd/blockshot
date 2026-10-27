import { describe, expect, it } from 'vitest';
import type { HudState } from './hudState';
import { hudStore, mergeStable, publishHud, resetHud } from './hudStore';

const base = (): HudState => ({
  alive: true,
  everSpawned: true,
  locked: true,
  hp: 100,
  maxHp: 100,
  characterId: 'soldado',
  charName: 'Soldado',
  stamina: null,
  staminaLow: false,
  sprinting: false,
  speedFx: 0,
  ability: null,
  shield: 0,
  shieldHit: false,
  adsSight: null,
  smoke: 0,
  grenadeAim: false,
  armor: 0,
  radar: false,
  infect: null,
  weaponName: 'Rifle de asalto',
  mag: 30,
  magSize: 30,
  reloading: false,
  reloadPct: 0,
  slot: 0,
  loadout: ['Rifle de asalto', 'Pistola', 'Cuchillo'],
  melee: false,
  gunLevel: 0,
  gunTotal: 0,
  scoped: false,
  protect: 0,
  hit: false,
  hitMark: false,
  hitHead: false,
  damage: 0,
  respawnIn: 0,
  killerName: '',
  players: [{ id: 'a', n: 'Ana', c: 'soldado', k: 0, d: 0, tm: 0, pg: 10, st: 0, cp: 0, lv: 0, md: 0 }],
  spread: 0.01,
  aim: 0,
  dmgDirs: [],
  mode: 'ffa',
  myTeam: 0,
  hitKey: 0,
  hitRed: false,
  combo: 0,
  comboKey: 0,
  ticks: [],
  shotKey: 0,
  damageKey: 0,
  deathKey: 0,
  teamScore: null,
  flags: null,
  ping: 10,
  chatOpen: false,
  grenades: 1,
  zones: null,
  round: null,
  replay: false,
});

describe('hud store', () => {
  it('keeps the previous object when nothing changed', () => {
    const a = base();
    expect(mergeStable(a, base())).toBe(a);
  });

  it('keeps the references of unchanged fields', () => {
    const a = base();
    const next = { ...base(), mag: 29 };
    const merged = mergeStable(a, next);
    expect(merged).not.toBe(a);
    expect(merged.mag).toBe(29);
    expect(merged.loadout).toBe(a.loadout);
    expect(merged.players).toBe(a.players);
  });

  it('only notifies subscribers when something changed', () => {
    resetHud();
    let calls = 0;
    const off = hudStore.subscribe(() => calls++);
    publishHud(base());
    publishHud(base());
    publishHud(base());
    expect(calls).toBe(1);
    publishHud({ ...base(), hp: 76 });
    expect(calls).toBe(2);
    off();
  });
});
