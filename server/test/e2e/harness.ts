// End-to-end harness: starts the real server in a child process and drives it with bot clients.
// The tests only use the public protocol, so they keep passing through internal refactors.
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, type Socket } from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import {
  PLAYER,
  getMap,
  type ClientToServerEvents,
  type MoveInput,
  type ServerToClientEvents,
  type Vec3,
} from '@blockshot/shared';
import { NavGrid } from './pathfinding';
import type { JoinResult, PlayerSnapshot, StateSnapshot } from '@blockshot/shared';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SERVER_ENTRY = 'src/index.ts';

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
  /** input commands are numbered; the server only simulates newer ones */
  private seq = 0;
  private slot = 0;
  private nav: NavGrid | null = null;

  constructor(
    url: string,
    readonly name: string,
  ) {
    this.s = io(url, { transports: ['websocket'], forceNew: true, parser: msgpackParser });
    this.s.on('player:spawned', (d) => {
      this.pos = { x: d.x, y: d.y, z: d.z };
      this.spawnedAt = Date.now();
    });
    this.s.on('state', (st) => (this.state = st));
    // Where the server says we are (the authority)
    this.s.on('player:ack', (d) => (this.pos = { x: d.s.x, y: d.s.y, z: d.s.z }));
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

  private joined(res: JoinResult): JoinResult {
    if (res.ok) this.nav = new NavGrid(getMap(res.room.mapId, res.room.size));
    return res;
  }

  async create(opts: Record<string, unknown>): Promise<JoinResult> {
    await this.connected();
    const res = await new Promise<JoinResult>((r) => this.s.emit('room:create', { nickname: this.name, ...opts }, r));
    return this.joined(res);
  }

  async join(roomId: string, password?: string): Promise<JoinResult> {
    await this.connected();
    const res = await new Promise<JoinResult>((r) =>
      this.s.emit('room:join', { roomId, nickname: this.name, ...(password ? { password } : {}) }, r),
    );
    return this.joined(res);
  }

  async spawn(characterId = 'soldado'): Promise<void> {
    const before = this.spawnedAt;
    this.s.emit('player:spawn', { characterId });
    await this.until(() => this.spawnedAt !== before, 3000, 'spawn');
  }

  /** Sends 50 ms of input (3 simulation steps) like the real client does. */
  private input(f: number, yaw: number): void {
    const c: MoveInput[] = [];
    for (let i = 0; i < 3; i++) c.push({ seq: this.seq++, f, s: 0, yaw, pitch: 0, b: 0, slot: this.slot });
    this.s.emit('player:input', { c });
  }

  /** Stands still facing -z (yaw 0), so the server keeps simulating the bot (gravity, regen…). */
  hold(): void {
    this.input(0, 0);
  }

  /** Walks to (x, z) around obstacles (A* over the map) and stops there facing -z. */
  async goTo(x: number, z: number): Promise<void> {
    const WAYPOINT_REACHED = 0.5;
    const ARRIVED = 0.35;
    const TIMEOUT_MS = 20000;
    const path = this.nav?.path({ x: this.pos.x, z: this.pos.z }, { x, z });
    if (!path) throw new Error(`${this.name}: no path to (${x}, ${z})`);
    const end = Date.now() + TIMEOUT_MS;
    for (const [idx, wp] of path.entries()) {
      const last = idx === path.length - 1;
      for (;;) {
        const dx = wp.x - this.pos.x;
        const dz = wp.z - this.pos.z;
        if (Math.hypot(dx, dz) < (last ? ARRIVED : WAYPOINT_REACHED)) break;
        if (Date.now() > end)
          throw new Error(
            `${this.name}: stuck at (${this.pos.x.toFixed(1)}, ${this.pos.z.toFixed(1)}) going to (${x}, ${z})`,
          );
        // forward is (-sin yaw, -cos yaw)
        this.input(1, Math.atan2(-dx, -dz));
        await sleep(50);
      }
    }
    // let the ground friction stop us
    for (let i = 0; i < 6; i++) {
      this.hold();
      await sleep(50);
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
    this.slot = slot;
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
