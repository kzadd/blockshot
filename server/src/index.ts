import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { SERVER_TICK_MS } from '@blockshot/shared';
import { serverConfig } from './config';
import { tickRoom } from './game/tick';
import { createApp } from './http/app';
import { logger } from './logger';
import { LOBBY_CHANNEL, attachGateway, type GameServer } from './network/gateway';
import { announce, findLanAddress, printBanner } from './network/lan';
import { RoomRegistry } from './rooms/registry';
import type { RoomChannel } from './rooms/room';

// server/src (dev) and server/dist (build) are both one level below server/
const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(here, '../../client/dist');

const httpServer = http.createServer(createApp(CLIENT_DIST));
const io: GameServer = new Server(httpServer, { cors: { origin: '*' } });

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

// Fixed tick: mode rules, regeneration and one snapshot per room
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.all()) tickRoom(room, now);
}, SERVER_TICK_MS);

httpServer.listen(serverConfig.port, '0.0.0.0', () => {
  const ip = findLanAddress();
  if (ip) announce(serverConfig.lanHost, ip, logger);
  printBanner(serverConfig.port, serverConfig.lanHost, ip);
});
