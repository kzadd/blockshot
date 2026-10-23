// End-to-end harness: starts the real server in a child process and drives it with bot clients.
// The tests only use the public protocol, so they keep passing through internal refactors.
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, type Socket } from 'socket.io-client';
import { PLAYER, type ClientToServerEvents, type ServerToClientEvents, type Vec3 } from '@blockshot/shared';
import type { JoinResult, PlayerSnapshot, StateSnapshot } from '@blockshot/shared';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SERVER_ENTRY = 'index.js';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() => resolve(typeof addr === 'object' && addr ? addr.port : 0));
    });
  });
}

export interface TestServer {
  url: string;
  output: () => string;
  stop: () => Promise<void>;
}

export async function startServer(): Promise<TestServer> {
  const port = await freePort();
  let out = '';
  const child: ChildProcess = spawn(process.execPath, ['--import', 'tsx', SERVER_ENTRY], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(port), NOMBRE: `test${port}`, LOG_LEVEL: 'warn' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d: Buffer) => (out += d.toString()));
  child.stderr?.on('data', (d: Buffer) => (out += d.toString()));
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${url}/ping`);
      if (res.ok) break;
    } catch {
      await sleep(100);
    }
    if (i === 99) throw new Error(`server did not start:\n${out}`);
  }
  return {
    url,
    output: () => out,
    stop: () =>
      new Promise((resolve) => {
        child.once('exit', () => resolve());
        child.kill();
      }),
  };
}

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type AnyEvent = [string, unknown];

export class Bot {
  readonly s: ClientSocket;
  pos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  state: StateSnapshot | null = null;
  events: AnyEvent[] = [];
  spawnedAt = 0;

  constructor(
    url: string,
    readonly name: string,
  ) {
    this.s = io(url, { transports: ['websocket'], forceNew: true });
    this.s.on('player:spawned', (d) => {
      this.pos = { x: d.x, y: d.y, z: d.z };
      this.spawnedAt = Date.now();
    });
    this.s.on('state', (st) => (this.state = st));
    this.s.on('player:correct', (d) => (this.pos = { ...d }));
    this.s.onAny((ev: string, d: unknown) => {
      if (ev !== 'state') this.events.push([ev, d]);
    });
  }

  get id(): string {
    return this.s.id ?? '';
  }

  async connected(): Promise<void> {
    if (this.s.connected) return;
    await new Promise<void>((r) => this.s.once('connect', () => r()));
  }

  me(): PlayerSnapshot | undefined {
    return this.state?.players.find((p) => p.id === this.id);
  }

  async create(opts: Record<string, unknown>): Promise<JoinResult> {
    await this.connected();
    return new Promise((r) => this.s.emit('room:create', { nickname: this.name, ...opts }, r));
  }

  async join(roomId: string, password?: string): Promise<JoinResult> {
    await this.connected();
    return new Promise((r) =>
      this.s.emit('room:join', { roomId, nickname: this.name, ...(password ? { password } : {}) }, r),
    );
  }

  async spawn(characterId = 'soldado'): Promise<void> {
    const before = this.spawnedAt;
    this.s.emit('player:spawn', { characterId });
    await this.until(() => this.spawnedAt !== before, 3000, 'spawn');
  }

  /** Report the current position (keeps the server's view of the bot alive and still). */
  hold(): void {
    this.s.emit('player:state', { ...this.pos, ry: 0, rx: 0, sl: 0, cr: 0 });
  }

  /** Walk to (x, z) in short steps. */
  async goTo(x: number, z: number, y = this.pos.y): Promise<void> {
    const STEP = 1.2;
    for (;;) {
      const dx = x - this.pos.x;
      const dy = y - this.pos.y;
      const dz = z - this.pos.z;
      const d = Math.hypot(dx, dy, dz);
      const k = Math.min(1, STEP / (d || 1));
      this.pos = { x: this.pos.x + dx * k, y: this.pos.y + dy * k, z: this.pos.z + dz * k };
      this.hold();
      await sleep(50);
      if (d < 0.01) return;
    }
  }

  async idle(ms: number): Promise<void> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      this.hold();
      await sleep(50);
    }
  }

  eye(): Vec3 {
    return [this.pos.x, this.pos.y + PLAYER.eye, this.pos.z];
  }

  shootDir(d: Vec3): void {
    this.s.emit('player:shoot', { o: this.eye(), d: [d], lag: 0 });
  }

  /** Shoot at another bot's body (dy = height above its feet). */
  shootAt(target: Bot, dy = 1.3): void {
    const o = this.eye();
    const t: Vec3 = [target.pos.x, target.pos.y + dy, target.pos.z];
    const v = t.map((q, i) => q - o[i]!) as Vec3;
    const len = Math.hypot(...v);
    this.shootDir(v.map((q) => q / len) as Vec3);
  }

  reload(): void {
    this.s.emit('player:reload');
  }

  switchSlot(slot: number): void {
    this.s.emit('player:switch', { slot });
  }

  /** Drop spawn protection by shooting straight up. */
  dropProtection(): void {
    this.shootDir([0, 1, 0]);
  }

  count(ev: string, pred: (d: never) => boolean = () => true): number {
    return this.events.filter(([e, d]) => e === ev && pred(d as never)).length;
  }

  find<T = unknown>(ev: string, pred: (d: T) => boolean = () => true): T | undefined {
    return this.events.find(([e, d]) => e === ev && pred(d as T))?.[1] as T | undefined;
  }

  async until(cond: () => boolean, timeout = 5000, what = 'condition'): Promise<void> {
    const end = Date.now() + timeout;
    while (!cond()) {
      if (Date.now() > end) throw new Error(`timeout waiting for ${what} (${this.name})`);
      await sleep(25);
    }
  }

  close(): void {
    this.s.close();
  }
}

/** Keep shooting `target` until `done()` or `tries` run out, keeping both bots reported in place. */
export async function shootUntil(
  shooter: Bot,
  target: Bot,
  done: () => boolean,
  { tries = 20, every = 130, dy = 1.3 } = {},
): Promise<void> {
  for (let i = 0; i < tries && !done(); i++) {
    shooter.hold();
    target.hold();
    shooter.shootAt(target, dy);
    await sleep(every);
  }
}
