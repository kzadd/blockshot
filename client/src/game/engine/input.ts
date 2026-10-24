// Keyboard and mouse: look direction, pointer lock / fullscreen, and the movement Command of each step.
import {
  BTN_AIM,
  BTN_CROUCH,
  BTN_FIRE,
  BTN_JUMP,
  BTN_JUMP_PRESSED,
  BTN_SHOT,
  BTN_SPRINT,
  type MoveInput,
} from '@blockshot/shared';
import { sfx } from '../audio/sound';

// Keys the game keeps while in fullscreen (Chrome/Edge): so Ctrl+W, Ctrl+T, Ctrl+N… close nothing.
// Esc too: the game opens the pause (it releases the mouse) and another Esc can capture it again without
// a click. Leaving fullscreen needs Esc to be held down.
const LOCK_KEYS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => 'Key' + c),
  ...'0123456789'.split('').map((d) => 'Digit' + d),
  'Tab',
  'Space',
  'ControlLeft',
  'ControlRight',
  'F1',
  'Escape',
];
/** radians per pixel at sensitivity 1 */
const MOUSE_RADIANS = 0.0022;
const PITCH_LIMIT = 1.55;
const MOUSE_LEFT = 0;
const MOUSE_RIGHT = 2;

/** What keys and wheel ask the game to do (weapon actions, focus). */
export interface InputActions {
  canAct(): boolean;
  switchSlot(slot: number): void;
  switchPrevious(): void;
  cycleSlot(dir: 1 | -1): void;
  reload(): void;
  /** look sensitivity multiplier (aiming compensates the zoom) */
  sensMultiplier(): number;
  /** the player pulled the view down by this much (it cancels recoil) */
  pulledDown(radians: number): void;
  resize(): void;
}

export class InputController {
  readonly keys = new Set<string>();
  yaw = 0;
  pitch = 0;
  locked = false;
  mouseDown = false;
  /** a click shorter than one frame is not lost */
  clicked = false;
  triggerReleased = true;
  aiming = false;
  sens = 1;
  /** Space went down since the last command */
  private jumpPressed = false;
  /** a shot was fired since the last command */
  private shot = false;
  private readonly off: (() => void)[] = [];

  constructor(
    private readonly el: HTMLCanvasElement,
    private readonly actions: InputActions,
  ) {
    const on = <K extends keyof WindowEventMap>(
      target: Window | Document,
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.off.push(() => target.removeEventListener(type, fn as EventListener));
    };
    on(window, 'keydown', (e) => this.keydown(e));
    on(window, 'keyup', (e) => this.keys.delete(e.code));
    on(window, 'mousemove', (e) => this.mousemove(e));
    on(window, 'mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === MOUSE_LEFT) this.mouseDown = this.clicked = true;
      if (e.button === MOUSE_RIGHT) this.aiming = true;
    });
    on(window, 'mouseup', (e) => {
      if (e.button === MOUSE_LEFT) {
        this.mouseDown = false;
        this.triggerReleased = true;
      }
      if (e.button === MOUSE_RIGHT) this.aiming = false;
    });
    on(window, 'wheel', (e) => this.locked && this.actions.canAct() && this.actions.cycleSlot(e.deltaY < 0 ? -1 : 1), {
      passive: true,
    });
    on(window, 'contextmenu', (e) => e.preventDefault());
    on(window, 'resize', () => this.actions.resize());
    on(window, 'blur', () => this.keys.clear());
    on(document, 'pointerlockchange' as keyof WindowEventMap, () => this.lockChanged());
    const click = () => this.actions.canAct() && this.requestLock();
    el.addEventListener('click', click);
    this.off.push(() => el.removeEventListener('click', click));
  }

  private keydown(e: KeyboardEvent): void {
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    // While playing, Ctrl + letter must do nothing in the browser (Ctrl+S, Ctrl+D, Ctrl+F…)
    if (this.locked && (e.ctrlKey || e.metaKey) && e.code !== 'Escape') e.preventDefault();
    this.keys.add(e.code);
    // Esc with the mouse captured: pause (resuming with Esc is done by the Game screen, which knows about menus)
    if (e.code === 'Escape' && this.locked && !e.repeat) document.exitPointerLock?.();
    if (!this.actions.canAct() || !this.locked || e.repeat) return;
    if (e.code === 'Space') this.jumpPressed = true;
    if (e.code === 'Digit1') this.actions.switchSlot(0);
    if (e.code === 'Digit2') this.actions.switchSlot(1);
    if (e.code === 'Digit3') this.actions.switchSlot(2);
    if (e.code === 'KeyQ') this.actions.switchPrevious();
    if (e.code === 'KeyR') this.actions.reload();
  }

  private mousemove(e: MouseEvent): void {
    if (!this.locked || !this.actions.canAct()) return;
    // While aiming the view feels like hip fire (the zoom is compensated), a bit slower per
    // «Sensibilidad al apuntar» in Settings
    const s = MOUSE_RADIANS * this.sens * this.actions.sensMultiplier();
    this.yaw -= e.movementX * s;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - e.movementY * s));
    // pulling the view down yourself to compensate recoil means it no longer needs recovering
    if (e.movementY > 0) this.actions.pulledDown(e.movementY * s);
  }

  private lockChanged(): void {
    this.locked = document.pointerLockElement === this.el;
    if (!this.locked) {
      this.mouseDown = false;
      this.aiming = false;
      this.keys.clear();
    }
  }

  requestLock(): void {
    sfx.unlock();
    // Always fullscreen: that is what lets the browser block Ctrl+W and the other shortcuts
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() =>
          (navigator as Navigator & { keyboard?: { lock(keys: string[]): Promise<void> } }).keyboard?.lock(LOCK_KEYS),
        )
        .catch(() => {});
    }
    try {
      const p = (this.el.requestPointerLock as (opts?: { unadjustedMovement?: boolean }) => Promise<void> | void)({
        unadjustedMovement: true,
      });
      if (p && 'catch' in p) p.catch(() => this.el.requestPointerLock());
    } catch {
      this.el.requestPointerLock();
    }
  }

  markShot(): void {
    this.shot = true;
  }

  private held(...codes: string[]): boolean {
    return this.locked && codes.some((c) => this.keys.has(c));
  }

  /** The Command for one simulation step. Without the mouse captured nothing is pressed. */
  command(seq: number, slot: number): MoveInput {
    const k = this.keys;
    const live = this.locked;
    const f = live ? (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) : 0;
    const s = live ? (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) : 0;
    let b = 0;
    if (this.held('Space')) b |= BTN_JUMP;
    if (live && this.jumpPressed) b |= BTN_JUMP_PRESSED;
    if (this.held('KeyC', 'ControlLeft', 'ControlRight')) b |= BTN_CROUCH;
    if (this.held('ShiftLeft', 'ShiftRight')) b |= BTN_SPRINT;
    if (this.aiming) b |= BTN_AIM;
    if (this.mouseDown) b |= BTN_FIRE;
    if (this.shot) b |= BTN_SHOT;
    this.jumpPressed = false;
    this.shot = false;
    return { seq, f, s, yaw: this.yaw, pitch: this.pitch, b, slot };
  }

  /** Forgets the trigger: a click already made (or a held button) does not fire until pressed again. */
  releaseTrigger(): void {
    this.mouseDown = false;
    this.clicked = false;
    this.triggerReleased = true;
  }

  clearButtons(): void {
    this.releaseTrigger();
    this.aiming = false;
  }

  dispose(): void {
    for (const f of this.off) f();
    (navigator as Navigator & { keyboard?: { unlock(): void } }).keyboard?.unlock();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
