// FPS / frame time panel, only in development (`pnpm dev`). The production build drops this code and the
// stats.js dependency entirely (import.meta.env.DEV is false there).

export interface FrameStats {
  update(): void;
  dispose(): void;
}

export async function createDevStats(container: HTMLElement): Promise<FrameStats | null> {
  if (!import.meta.env.DEV) return null;
  const { default: Stats } = await import('stats.js');
  const stats = new Stats();
  stats.dom.style.cssText = 'position:absolute;right:8px;bottom:120px;z-index:50;opacity:0.85';
  container.appendChild(stats.dom);
  return {
    update: () => stats.update(),
    dispose: () => stats.dom.remove(),
  };
}
