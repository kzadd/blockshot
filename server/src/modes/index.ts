import type { ModeId } from '@blockshot/shared';
import type { Room } from '../rooms/room';
import { createBomb } from './bomb';
import { createCaptureTheFlag } from './captureTheFlag';
import { createDomination } from './domination';
import { createFreeForAll } from './freeForAll';
import { createFreezeTag } from './freezeTag';
import type { GameMode } from './gameMode';
import { createGunGame } from './gunGame';
import { createInfected } from './infected';
import { createInstagib } from './instagib';
import { createKillConfirmed } from './killConfirmed';
import { createLastManStanding } from './lastManStanding';
import { createRace } from './race';
import { createRounds } from './rounds';
import { createTeamDeathmatch } from './teamDeathmatch';

/** Open/closed: a new mode is a new file plus one line here. */
const FACTORIES: Record<ModeId, (room: Room) => GameMode> = {
  ffa: createFreeForAll,
  teams: createTeamDeathmatch,
  ctf: createCaptureTheFlag,
  gungame: createGunGame,
  kc: createKillConfirmed,
  infect: createInfected,
  dom: createDomination,
  rounds: createRounds,
  race: createRace,
  lms: createLastManStanding,
  insta: createInstagib,
  freeze: createFreezeTag,
  bomb: createBomb,
};

export const createMode = (id: ModeId, room: Room): GameMode => FACTORIES[id](room);
