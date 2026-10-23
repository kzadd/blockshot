// Game events → sounds. The only place that decides what each event sounds like.
import type { EventBus } from '../engine/events';
import { sfx } from './sound';

/** Landing faster than this (m/s) plays the loudest thud. */
const LOUD_LANDING = 20;
const TAG_CONFIRM_HZ = 988;
const TAG_DENY_HZ = 440;
const FLAG_TAKE_HZ = 880;
const FLAG_RETURN_HZ = 520;

export function attachAudio(bus: EventBus): () => void {
  const off = [
    bus.on('jump', () => sfx.jump()),
    bus.on('land', ({ fall }) => sfx.land(Math.min(1, -fall / LOUD_LANDING))),
    bus.on('slide', () => sfx.slide()),
    bus.on('step', ({ volume }) => sfx.step(volume)),
    bus.on('pad', () => sfx.pad()),
    bus.on('shot', ({ weapon, volume }) => sfx.shot(weapon, volume)),
    bus.on('reload', () => sfx.reload()),
    bus.on('hit', ({ head, kill }) => sfx.hit(head, kill)),
    bus.on('hurt', () => sfx.hurt()),
    bus.on('streak', () => sfx.streak()),
    bus.on('tag', ({ confirm }) =>
      confirm ? sfx.blip(TAG_CONFIRM_HZ, 0.1, 'triangle', 0.22) : sfx.blip(TAG_DENY_HZ, 0.12, 'triangle', 0.18),
    ),
    bus.on('flag', ({ type }) => {
      if (type === 'capture') sfx.streak();
      else if (type === 'take' || type === 'return')
        sfx.blip(type === 'take' ? FLAG_TAKE_HZ : FLAG_RETURN_HZ, 0.12, 'triangle', 0.2);
    }),
  ];
  return () => off.forEach((f) => f());
}
