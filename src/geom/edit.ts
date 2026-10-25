// Geometry edits. Every function returns a new Part; inputs are never mutated.
import { bbox, dist, dot, norm, sub, type Hole, type Part, type Vec } from './polygon';

const clonePart = (p: Part): Part => ({
  outline: p.outline.map((v) => ({ ...v })),
  holes: p.holes.map((h) => ({ ...h })),
});

/**
 * Stretches the part along the direction of edge `i` so that the edge measures `length`.
 * Every vertex and hole centre beyond the plane through the edge midpoint (perpendicular to
 * the edge) moves by the length difference. Angles of orthogonal geometry are preserved.
 */
export function stretchEdge(part: Part, i: number, length: number, moveHoles = true): Part {
  const n = part.outline.length;
  const a = part.outline[i];
  const b = part.outline[(i + 1) % n];
  const delta = length - dist(a, b);
  const u = norm(sub(b, a));
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const cut = dot(mid, u);
  const shift = (p: Vec): Vec => (dot(p, u) > cut ? { x: p.x + u.x * delta, y: p.y + u.y * delta } : p);
  return {
    outline: part.outline.map((v) => shift({ ...v })),
    holes: part.holes.map((h) => (moveHoles ? { ...h, ...shift(h) } : { ...h })),
  };
}

/** Moves only the end vertex of edge `i` along the edge direction so the edge measures `length`. */
export function setEdgeEndpoint(part: Part, i: number, length: number): Part {
  const out = clonePart(part);
  const n = out.outline.length;
  const a = out.outline[i];
  const j = (i + 1) % n;
  const u = norm(sub(out.outline[j], a));
  out.outline[j] = { x: a.x + u.x * length, y: a.y + u.y * length };
  return out;
}

/** Stretches about the bounding-box centre line so the overall width (axis x) or height (axis y) matches. */
export function stretchOverall(part: Part, axis: 'x' | 'y', size: number): Part {
  const b = bbox(part.outline);
  const lo = axis === 'x' ? b.minX : b.minY;
  const hi = axis === 'x' ? b.maxX : b.maxY;
  const delta = size - (hi - lo);
  const mid = (lo + hi) / 2;
  const shift = <T extends Vec>(p: T): T => (p[axis] > mid ? { ...p, [axis]: p[axis] + delta } : { ...p });
  return { outline: part.outline.map(shift), holes: part.holes.map(shift) };
}

/** Uniform scale about the outline's minimum corner. Hole diameters scale only if requested. */
export function scalePart(part: Part, factor: number, scaleHoles: boolean): Part {
  const b = bbox(part.outline);
  const f = (p: Vec) => ({ x: b.minX + (p.x - b.minX) * factor, y: b.minY + (p.y - b.minY) * factor });
  return {
    outline: part.outline.map(f),
    holes: part.holes.map((h) => ({ ...h, ...f(h), d: scaleHoles ? h.d * factor : h.d })),
  };
}

export function moveVertex(part: Part, i: number, p: Vec): Part {
  const out = clonePart(part);
  out.outline[i] = { x: p.x, y: p.y };
  return out;
}

export function deleteVertex(part: Part, i: number): Part {
  if (part.outline.length <= 3) return part;
  const out = clonePart(part);
  out.outline.splice(i, 1);
  return out;
}

/** Inserts a vertex on edge `i` at parameter t (0–1). */
export function insertVertex(part: Part, i: number, t = 0.5): Part {
  const out = clonePart(part);
  const a = out.outline[i];
  const b = out.outline[(i + 1) % out.outline.length];
  out.outline.splice(i + 1, 0, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  return out;
}

export function updateHole(part: Part, id: string, patch: Partial<Omit<Hole, 'id'>>): Part {
  return { outline: part.outline, holes: part.holes.map((h) => (h.id === id ? { ...h, ...patch } : h)) };
}

export function addHole(part: Part, hole: Hole): Part {
  return { outline: part.outline, holes: [...part.holes, hole] };
}

export function deleteHole(part: Part, id: string): Part {
  return { outline: part.outline, holes: part.holes.filter((h) => h.id !== id) };
}

/**
 * Snaps edges within `tolDeg` of horizontal or vertical to exact orthogonality, which removes
 * pixel-level wobble from scanned rectilinear parts. Diagonal edges are left alone.
 */
export function squareUp(part: Part, tolDeg = 3): Part {
  const out = clonePart(part);
  const pts = out.outline;
  const n = pts.length;
  const tol = Math.tan((tolDeg * Math.PI) / 180);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      if (dx > 0 && dy / dx <= tol) {
        const y = (a.y + b.y) / 2;
        a.y = y;
        b.y = y;
      } else if (dy > 0 && dx / dy <= tol) {
        const x = (a.x + b.x) / 2;
        a.x = x;
        b.x = x;
      }
    }
  }
  return out;
}

/** Rounds every vertex, hole centre, and hole diameter to the nearest multiple of `step` mm. */
export function snapToGrid(part: Part, step: number): Part {
  const r = (v: number) => Math.round(v / step) * step;
  return {
    outline: part.outline.map((p) => ({ x: r(p.x), y: r(p.y) })),
    holes: part.holes.map((h) => ({ ...h, x: r(h.x), y: r(h.y), d: Math.max(step, r(h.d)) })),
  };
}

/** Removes consecutive duplicate vertices and vertices lying on a straight line. */
export function cleanOutline(poly: Vec[], eps = 1e-6): Vec[] {
  const out: Vec[] = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > eps) out.push(p);
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) <= eps) out.pop();
  return out;
}

/** Moves the whole part so its outline's minimum corner sits at the origin. */
export function normalizeOrigin(part: Part): Part {
  const b = bbox(part.outline);
  const t = (p: Vec) => ({ x: p.x - b.minX, y: p.y - b.minY });
  return { outline: part.outline.map(t), holes: part.holes.map((h) => ({ ...h, ...t(h) })) };
}
