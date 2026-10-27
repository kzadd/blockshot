import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '@blockshot/shared';

// server/src (dev) and server/dist (build) are both two levels below the project root
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const DEFAULT_LAN_NAME = 'blockshot';

export const serverConfig = {
  port: Number(process.env.PORT) || DEFAULT_PORT,
  /** Name announced on the local network (mDNS). Change it with NOMBRE when two servers share a network. */
  lanHost: `${(process.env.NOMBRE || DEFAULT_LAN_NAME).toLowerCase()}.local`,
  logLevel: process.env.LOG_LEVEL ?? 'info',
  /** All-time ranking, kept between restarts. Change it with RANKING (tests use their own file). */
  rankingFile: process.env.RANKING || path.join(ROOT, 'data', 'ranking.json'),
};
