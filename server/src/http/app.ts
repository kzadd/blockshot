import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';

/** Serves the built client and a /ping route to test the connection from another PC. */
export function createApp(clientDist: string): Express {
  const app = express();
  app.get('/ping', (_req, res) => {
    res.type('text/plain').send('ok');
  });
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  } else {
    app.get('/', (_req, res) => {
      res.send(
        '<h2>Cliente sin compilar</h2><p>Ejecuta <code>pnpm clase</code>, o usa <code>pnpm dev</code> y entra por el puerto 5173.</p>',
      );
    });
  }
  return app;
}
