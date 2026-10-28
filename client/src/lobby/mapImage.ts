import type { MapId } from '@blockshot/shared';

/** Aerial screenshot of a map (client/public/maps), used for cards and the blurred menu background. */
export const mapImage = (id: MapId): string => `${import.meta.env.BASE_URL}maps/${id}.jpg`;

const blurred = new Map<MapId, Promise<string>>();
/**
 * The map blurred once into a 64×36 image that the browser stretches as the menu background: a full-screen CSS
 * blur would cost every frame on integrated graphics.
 */
export function blurredMap(id: MapId): Promise<string> {
  let p = blurred.get(id);
  if (!p) {
    p = new Promise((done) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 36;
        const g = c.getContext('2d');
        if (!g) return done(mapImage(id));
        g.filter = 'blur(2px)';
        g.drawImage(img, -4, -4, 72, 44); // a little bigger so the blur has no dark edge
        done(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => done('');
      img.src = mapImage(id);
    });
    blurred.set(id, p);
  }
  return p;
}
