import { DEFAULT_PORT } from '@blockshot/shared';

const DEFAULT_LAN_NAME = 'blockshot';

export const serverConfig = {
  port: Number(process.env.PORT) || DEFAULT_PORT,
  /** Name announced on the local network (mDNS). Change it with NOMBRE when two servers share a network. */
  lanHost: `${(process.env.NOMBRE || DEFAULT_LAN_NAME).toLowerCase()}.local`,
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
