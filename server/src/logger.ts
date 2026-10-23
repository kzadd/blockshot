import { pino } from 'pino';
import { serverConfig } from './config';

// Pretty, coloured lines when a teacher runs the server in a terminal; JSON lines otherwise (pipes, CI)
export const logger = pino({
  level: serverConfig.logLevel,
  ...(process.stdout.isTTY
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

export type Logger = typeof logger;
