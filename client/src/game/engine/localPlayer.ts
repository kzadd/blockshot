// Client-side prediction of our own player. Every command is simulated immediately (the game responds at
// once) and kept until the server confirms it; on each ack the state is reset to the authority and the
// unconfirmed commands are replayed. Small disagreements are smoothed out instead of snapping.
import * as THREE from 'three';
import {
  FIXED_DT,
  createMoveState,
  stepMovement,
  type AckMessage,
  type MoveContext,
  type MoveEvents,
  type MoveInput,
  type MoveState,
} from '@blockshot/shared';

/** Corrections smaller than this (m) are applied silently; bigger ones are smoothed. */
const SNAP_EPSILON = 1e-4;
/** Corrections bigger than this (m) snap at once (respawn, fell out of the map…). */
const SNAP_DISTANCE = 4;
/** How fast a correction is smoothed out (1/s). */
const CORRECTION_DECAY = 12;
/** Never keep more than this many unconfirmed commands (2 s): the server must be lagging badly. */
const MAX_PENDING = 120;

export class LocalPlayer {
  state: MoveState = createMoveState(0, 0, 0);
  private prev = new THREE.Vector3();
  private readonly pending: MoveInput[] = [];
  private unsent: MoveInput[] = [];
  /** visual offset left by the last correction, decays to zero */
  private readonly offset = new THREE.Vector3();
  private seq = 0;

  reset(x: number, y: number, z: number): void {
    this.state = createMoveState(x, y, z);
    this.prev.set(x, y, z);
    this.pending.length = 0;
    this.unsent = [];
    this.offset.set(0, 0, 0);
  }

  nextSeq(): number {
    return this.seq++;
  }

  /** Simulates one command now and queues it for the server. */
  step(input: MoveInput, ctx: MoveContext): MoveEvents {
    this.prev.set(this.state.x, this.state.y, this.state.z);
    const ev = stepMovement(this.state, input, FIXED_DT, ctx);
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    this.unsent.push(input);
    return ev;
  }

  /** Commands not sent to the server yet (and forgets them). */
  takeUnsent(): MoveInput[] {
    const out = this.unsent;
    this.unsent = [];
    return out;
  }

  /** Server says where we are after command `ack.seq`: reset to it and replay what it has not seen yet. */
  reconcile(ack: AckMessage, ctxFor: (input: MoveInput) => MoveContext): void {
    while (this.pending.length && this.pending[0]!.seq <= ack.seq) this.pending.shift();
    const before = new THREE.Vector3(this.state.x, this.state.y, this.state.z);
    this.state = { ...ack.s };
    for (const input of this.pending) stepMovement(this.state, input, FIXED_DT, ctxFor(input));
    const error = before.sub(new THREE.Vector3(this.state.x, this.state.y, this.state.z));
    const len = error.length();
    if (len < SNAP_EPSILON) return;
    if (len > SNAP_DISTANCE) {
      this.offset.set(0, 0, 0);
      this.prev.set(this.state.x, this.state.y, this.state.z);
      return;
    }
    // Keep drawing exactly where we were and slide towards the corrected trajectory: the previous step
    // moves with the correction and the offset makes up the difference, then fades
    this.prev.sub(error);
    this.offset.add(error);
  }

  /** Position to draw: between the last two steps (alpha) plus the fading correction. */
  renderPosition(alpha: number, dt: number, out: THREE.Vector3): THREE.Vector3 {
    this.offset.multiplyScalar(Math.exp(-CORRECTION_DECAY * dt));
    return out
      .set(this.state.x, this.state.y, this.state.z)
      .sub(this.prev)
      .multiplyScalar(alpha)
      .add(this.prev)
      .add(this.offset);
  }

  velocity(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.state.vx, this.state.vy, this.state.vz);
  }
}
