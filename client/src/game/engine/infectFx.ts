// Infectados on screen: the blackouts (the whole picture darkens through the tone mapping exposure, so the map's
// lights need no change, and a flashlight follows the view) and the Paciente cero's scream.
import * as THREE from 'three';
import { sfx } from '../audio/sound';

/** Exposure left with the lights out, how fast it fades in and out (1/s) and how often it flickers in the warning. */
const DARK_EXPOSURE = 0.07;
const FADE = 5;
const FLICKER = 0.12;
/** The flashlight: one spot without shadows, always in the scene (intensity 0 with the lights on: adding a light
 * later would recompile every material). Bright, because the dimmed exposure darkens it too. */
const LAMP = { color: 0xfff1d6, intensity: 120, distance: 30, angle: 0.45, penumbra: 0.55, decay: 1.4, ahead: 10 };
/** The scream is heard from this far (m). */
const SCREAM_RANGE = 45;

export class InfectFx {
  private readonly lamp = new THREE.SpotLight(LAMP.color, 0, LAMP.distance, LAMP.angle, LAMP.penumbra, LAMP.decay);
  private readonly dir = new THREE.Vector3();
  private dark = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly exposure: number,
  ) {
    scene.add(this.lamp, this.lamp.target);
  }

  /** `blackout`: 0 lights on, 1 about to go (they flicker), 2 out. */
  update(dt: number, blackout: number, camera: THREE.Camera): void {
    const target = blackout === 2 ? 1 : blackout === 1 && Math.random() < FLICKER ? 0.7 : 0;
    this.dark += (target - this.dark) * Math.min(1, dt * FADE);
    this.renderer.toneMappingExposure = this.exposure * (1 - (1 - DARK_EXPOSURE) * this.dark);
    this.lamp.intensity = blackout === 2 ? LAMP.intensity * this.dark : 0;
    if (!this.lamp.intensity) return;
    camera.getWorldDirection(this.dir);
    this.lamp.position.copy(camera.position);
    this.lamp.target.position.copy(camera.position).addScaledVector(this.dir, LAMP.ahead);
  }

  /** A low, rasping roar; louder the closer it is. */
  scream(dist: number): void {
    const vol = Math.max(0.08, 1 - dist / SCREAM_RANGE) * 0.35;
    sfx.blip(140, 0.7, 'sawtooth', vol);
    sfx.blip(95, 0.8, 'sawtooth', vol * 0.8, 0.05);
    sfx.thud(80, 0.6, vol);
  }

  dispose(): void {
    this.scene.remove(this.lamp, this.lamp.target);
    this.lamp.dispose();
    this.renderer.toneMappingExposure = this.exposure;
  }
}
