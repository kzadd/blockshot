// Raycasting sin dependencias: lo usan servidor (autoridad) y cliente (efectos).

export function rayAABB(o, d, min, max) {
  let tmin = 0;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return Infinity;
    } else {
      let t1 = (min[i] - o[i]) / d[i];
      let t2 = (max[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

export function raySphere(o, d, c, r) {
  const ox = o[0] - c[0];
  const oy = o[1] - c[1];
  const oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  return t < 0 ? Infinity : t;
}

// Hitboxes de un jugador (p.x, p.y, p.z = pies). Al deslizarse o agacharse es más bajo.
export function hitboxes(p) {
  const s = p.sl || p.cr ? 0.5 : 0;
  return {
    bmin: [p.x - 0.38, p.y, p.z - 0.38],
    bmax: [p.x + 0.38, p.y + 1.45 - s, p.z + 0.38],
    head: [p.x, p.y + 1.64 - s, p.z],
    hr: 0.27,
  };
}

// Devuelve { t, hit } donde hit = null | {type:'wall'} | {type:'player', id, head}
export function castShot(o, d, colliders, players, ignoreId, range) {
  let t = range;
  let hit = null;
  for (const b of colliders) {
    const bt = rayAABB(o, d, b.min, b.max);
    if (bt < t) {
      t = bt;
      hit = { type: 'wall' };
    }
  }
  for (const p of players) {
    if (p.id === ignoreId || !p.alive) continue;
    const hb = hitboxes(p);
    const th = raySphere(o, d, hb.head, hb.hr);
    if (th < t) {
      t = th;
      hit = { type: 'player', id: p.id, head: true };
    }
    const tb = rayAABB(o, d, hb.bmin, hb.bmax);
    if (tb < t) {
      t = tb;
      hit = { type: 'player', id: p.id, head: false };
    }
  }
  return { t, hit };
}
