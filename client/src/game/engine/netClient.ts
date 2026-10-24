// The engine's side of the socket: typed sends, handlers that are removed on dispose, and the ping.
import { PING_INTERVAL_MS, type MoveInput, type ServerToClientEvents, type ShootMessage } from '@blockshot/shared';
import type { GameSocket } from '../../network/socket';

/** Smoothing of the measured round trip time (weight of the old value). */
const RTT_SMOOTHING = 0.7;

export class NetClient {
  rtt = 0;
  private readonly offs: (() => void)[] = [];
  private readonly pingTimer: ReturnType<typeof setInterval>;

  constructor(private readonly socket: GameSocket) {
    // Ping: round trip every 2 s (used for lag compensation and the scoreboard)
    const ping = () => {
      const t0 = performance.now();
      this.socket.emit('net:ping', { rtt: this.rtt }, () => {
        const rtt = performance.now() - t0;
        this.rtt = this.rtt ? this.rtt * RTT_SMOOTHING + rtt * (1 - RTT_SMOOTHING) : rtt;
      });
    };
    ping();
    this.pingTimer = setInterval(ping, PING_INTERVAL_MS);
  }

  on<E extends keyof ServerToClientEvents>(event: E, fn: ServerToClientEvents[E]): void {
    this.socket.on(event, fn as never);
    this.offs.push(() => this.socket.off(event, fn as never));
  }

  inputs(c: MoveInput[]): void {
    if (c.length) this.socket.emit('player:input', { c });
  }
  shoot(msg: ShootMessage): void {
    this.socket.emit('player:shoot', msg);
  }
  reload(): void {
    this.socket.emit('player:reload');
  }
  switchSlot(slot: number): void {
    this.socket.emit('player:switch', { slot });
  }
  spawn(characterId: string, skin: string): void {
    this.socket.emit('player:spawn', { characterId, skin });
  }

  dispose(): void {
    clearInterval(this.pingTimer);
    for (const f of this.offs) f();
  }
}
