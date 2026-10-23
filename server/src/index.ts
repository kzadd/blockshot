import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import msgpackParser from 'socket.io-msgpack-parser';
import { FIXED_DT, SIM_STEPS_PER_TICK } from '@blockshot/shared';
import { serverConfig } from './config';
import { startFixedLoop } from './game/loop';
import { snapshotRoom } from './game/tick';
import { createApp } from './http/app';
import { logger } from './logger';
import { LOBBY_CHANNEL, attachGateway, type GameServer } from './network/gateway';
import { announce, findLanAddress, printBanner } from './network/lan';
import { simulateRoom } from './players/movement';
import { RoomRegistry } from './rooms/registry';
import type { RoomChannel } from './rooms/room';

// server/src (dev) and server/dist (build) are both one level below server/
const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(here, '../../client/dist');

const httpServer = http.createServer(createApp(CLIENT_DIST));
// MessagePack instead of JSON: snapshots and acks are ~27 % smaller and faster to decode
const io: GameServer = new Server(httpServer, { cors: { origin: '*' }, parser: msgpackParser });

const channelFor = (roomId: string): RoomChannel => ({
  broadcast: (event, args, exceptId) => {
    const target = exceptId ? io.to(roomId).except(exceptId) : io.to(roomId);
    target.emit(event, ...args);
  },
  broadcastVolatile: (event, args) => io.to(roomId).volatile.emit(event, ...args),
  to: (playerId, event, args) => io.to(playerId).emit(event, ...args),
});

const rooms = new RoomRegistry(channelFor, {
  changed: () => io.to(LOBBY_CHANNEL).emit('rooms', rooms.list()),
});
attachGateway(io, rooms, logger);

// Fixed tick: movement at 60 Hz; mode rules, regeneration, snapshots and acks every SIM_STEPS_PER_TICK steps
const MS_PER_S = 1000;
let step = 0;
startFixedLoop(FIXED_DT * MS_PER_S, (now) => {
  const snapshot = ++step % SIM_STEPS_PER_TICK === 0;
  for (const room of rooms.all()) {
    simulateRoom(room, FIXED_DT, now);
    if (snapshot) snapshotRoom(room, now);
  }
});

httpServer.listen(serverConfig.port, '0.0.0.0', () => {
  const ip = findLanAddress();
  if (ip) announce(serverConfig.lanHost, ip, logger);
  printBanner(serverConfig.port, serverConfig.lanHost, ip);
});
