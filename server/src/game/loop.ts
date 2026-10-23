// Fixed-step game loop: timers in Node are imprecise, so the loop wakes up often and runs as many fixed
// steps as real time requires (never more than MAX_CATCH_UP at once, e.g. after the process was paused).
import { performance } from 'node:perf_hooks';

const WAKE_MS = 4;
const MAX_CATCH_UP = 10;

export function startFixedLoop(stepMs: number, onStep: (now: number) => void): () => void {
  let next = performance.now();
  const timer = setInterval(() => {
    const t = performance.now();
    let steps = 0;
    while (t >= next && steps < MAX_CATCH_UP) {
      onStep(Date.now());
      next += stepMs;
      steps++;
    }
    if (steps === MAX_CATCH_UP) next = t + stepMs; // too far behind: drop the backlog instead of spiralling
  }, WAKE_MS);
  return () => clearInterval(timer);
}
