// Core 2D geometry. All part coordinates are millimetres, y-up.

export type Vec = { x: number; y: number };

export type Hole = { id: string; x: number; y: number; d: number };

/** A flat part: one closed outline (counter-clockwise) and circular through-holes. */
export type Part = { outline: Vec[]; holes: Hole[] };

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;
export const len = (a: Vec) => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec): Vec => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};

/** Signed area (shoelace). Positive for counter-clockwise in a y-up frame. */
export function signedArea(poly: Vec[]): number {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export const area = (poly: Vec[]) => Math.abs(signedArea(poly));

export function perimeter(poly: Vec[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) s += dist(poly[i], poly[(i + 1) % poly.length]);
  return s;
}

export function ensureCCW(poly: Vec[]): Vec[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

export function bbox(points: Vec[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function partBBox(part: Part): BBox {
  const b = bbox(part.outline);
  for (const h of part.holes) {
    const r = h.d / 2;
    b.minX = Math.min(b.minX, h.x - r);
    b.minY = Math.min(b.minY, h.y - r);
    b.maxX = Math.max(b.maxX, h.x + r);
    b.maxY = Math.max(b.maxY, h.y + r);
  }
  return b;
}

/** Interior angle at vertex i in degrees (0–360) for a CCW polygon. */
export function interiorAngle(poly: Vec[], i: number): number {
  const n = poly.length;
  const prev = poly[(i - 1 + n) % n];
  const cur = poly[i];
  const next = poly[(i + 1) % n];
  const a = sub(prev, cur);
  const b = sub(next, cur);
  let ang = Math.atan2(cross(b, a), dot(b, a)) * (180 / Math.PI);
  if (ang < 0) ang += 360;
  return ang;
}

export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return dist(p, add(a, scale(ab, t)));
}

export function distToPolygon(p: Vec, poly: Vec[]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

function segmentsIntersect(p1: Vec, p2: Vec, p3: Vec, p4: Vec): boolean {
  const d1 = cross(sub(p4, p3), sub(p1, p3));
  const d2 = cross(sub(p4, p3), sub(p2, p3));
  const d3 = cross(sub(p2, p1), sub(p3, p1));
  const d4 = cross(sub(p2, p1), sub(p4, p1));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Returns index pairs of non-adjacent edges that cross. */
export function selfIntersections(poly: Vec[]): [number, number][] {
  const n = poly.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsIntersect(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) out.push([i, j]);
    }
  }
  return out;
}

/**
 * Offsets a simple polygon by `d` (positive = outward for CCW input) using mitred joins.
 * Very sharp corners are bevelled so the path never spikes beyond 2·d.
 */
export function offsetPolygon(poly: Vec[], d: number): Vec[] {
  if (d === 0) return poly.map((p) => ({ ...p }));
  const n = poly.length;
  const out: Vec[] = [];
  const MITER_LIMIT = 2;
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    const e1 = norm(sub(cur, prev));
    const e2 = norm(sub(next, cur));
    // Outward normal of a CCW edge is the right-hand perpendicular.
    const n1 = { x: e1.y, y: -e1.x };
    const n2 = { x: e2.y, y: -e2.x };
    const bis = add(n1, n2);
    const bl = len(bis);
    if (bl < 1e-9) {
      out.push(add(cur, scale(n1, d)));
      continue;
    }
    const cosHalf = bl / 2;
    const m = d / cosHalf;
    if (Math.abs(m) > MITER_LIMIT * Math.abs(d)) {
      out.push(add(cur, scale(n1, d)), add(cur, scale(n2, d)));
    } else {
      out.push(add(cur, scale(norm(bis), m)));
    }
  }
  return out;
}

export function centroid(poly: Vec[]): Vec {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-12) return poly[0] ?? { x: 0, y: 0 };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
