// Image-processing pipeline: grayscale → Otsu threshold → largest connected component →
// Moore-neighbour boundary → Douglas–Peucker → hole detection with least-squares circle fit.
// Pure functions over typed arrays so the same code runs in the worker and in tests.

export type Px = { x: number; y: number };

export type DetectOptions = {
  /** 0–255. `null` selects Otsu's threshold automatically. */
  threshold: number | null;
  /** Treat bright pixels as the part (light part on a dark background). */
  invert: boolean;
  /** Douglas–Peucker tolerance in pixels. */
  epsilon: number;
  /** Ignore holes smaller than this many pixels of area. */
  minHoleArea: number;
};

export type DetectedHole = {
  cx: number;
  cy: number;
  /** Diameter from the least-squares circle fit, in pixels. */
  d: number;
  /** Diameter implied by the pixel area, in pixels. */
  dArea: number;
  /** RMS residual of the circle fit (px); large values mean the hole is not round. */
  residual: number;
  /** True when the circle fit was accepted; otherwise centre and diameter come from the pixel area. */
  fitted: boolean;
  area: number;
};

export type Detection = {
  width: number;
  height: number;
  threshold: number;
  otsu: number;
  histogram: number[];
  partArea: number;
  contour: Px[];
  polygon: Px[];
  holes: DetectedHole[];
  /** Foreground coverage of the whole frame (0–1). Very high values usually mean inverted polarity. */
  coverage: number;
};

export type Stage = 'grayscale' | 'threshold' | 'components' | 'boundary' | 'simplify' | 'holes';

export class DetectionError extends Error {}

export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) {
    g[j] = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
  }
  return g;
}

export function histogram(gray: Uint8Array): number[] {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  return hist;
}

/** Otsu's method: threshold maximising between-class variance. Pixels <= t form class 0. */
export function otsu(hist: number[]): number {
  let total = 0, sum = 0;
  for (let i = 0; i < 256; i++) {
    total += hist[i];
    sum += i * hist[i];
  }
  let sumB = 0, wB = 0, best = 0, bestT = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  return bestT;
}

/** Labels 4-connected regions where mask==1 and returns the largest one as a fresh mask. */
export function largestComponent(mask: Uint8Array, w: number, h: number): { mask: Uint8Array; area: number } {
  const labels = new Int32Array(w * h);
  const queue = new Int32Array(w * h);
  let next = 0, bestLabel = 0, bestArea = 0;
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || labels[s]) continue;
    next++;
    let head = 0, tail = 0, area = 0;
    queue[tail++] = s;
    labels[s] = next;
    while (head < tail) {
      const p = queue[head++];
      area++;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = next; queue[tail++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = next; queue[tail++] = p + 1; }
      if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = next; queue[tail++] = p - w; }
      if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = next; queue[tail++] = p + w; }
    }
    if (area > bestArea) {
      bestArea = area;
      bestLabel = next;
    }
  }
  const out = new Uint8Array(w * h);
  if (bestLabel) for (let i = 0; i < out.length; i++) out[i] = labels[i] === bestLabel ? 1 : 0;
  return { mask: out, area: bestArea };
}

// Clockwise 8-neighbourhood starting west, in image coordinates (y down).
const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const DY = [0, -1, -1, -1, 0, 1, 1, 1];

/** Moore-neighbour tracing of the outer boundary of a single-component mask. */
export function traceBoundary(mask: Uint8Array, w: number, h: number): Px[] {
  let start = -1;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { start = i; break; }
  if (start < 0) return [];
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const sx = start % w, sy = (start / w) | 0;
  const contour: Px[] = [{ x: sx, y: sy }];
  // The first pixel in raster order always has its west neighbour empty, so backtrack is west (dir 0).
  let cx = sx, cy = sy, back = 0;
  const limit = w * h * 4;
  for (let steps = 0; steps < limit; steps++) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      const nx = cx + DX[d], ny = cy + DY[d];
      if (at(nx, ny)) {
        // New backtrack: the neighbour checked just before this one, seen from the new pixel.
        const prev = (back + k - 1) % 8;
        const bx = cx + DX[prev], by = cy + DY[prev];
        cx = nx;
        cy = ny;
        back = dirOf(bx - cx, by - cy);
        found = true;
        break;
      }
    }
    if (!found) break; // isolated pixel
    if (cx === sx && cy === sy) break;
    contour.push({ x: cx, y: cy });
  }
  return contour;
}

function dirOf(dx: number, dy: number): number {
  for (let d = 0; d < 8; d++) if (DX[d] === dx && DY[d] === dy) return d;
  return 0;
}

function perpDist(p: Px, a: Px, b: Px): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  if (l === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / l;
}

export function douglasPeucker(pts: Px[], eps: number): Px[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx >= 0 && maxD > eps) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Closed-curve simplification: split at the two mutually farthest points, simplify each half. */
export function simplifyClosed(contour: Px[], eps: number): Px[] {
  if (contour.length < 4) return contour.slice();
  const a = 0;
  let b = 0, best = -1;
  for (let i = 0; i < contour.length; i++) {
    const d = (contour[i].x - contour[a].x) ** 2 + (contour[i].y - contour[a].y) ** 2;
    if (d > best) { best = d; b = i; }
  }
  const first = douglasPeucker(contour.slice(a, b + 1), eps);
  const second = douglasPeucker([...contour.slice(b), contour[a]], eps);
  const poly = [...first.slice(0, -1), ...second.slice(0, -1)];
  return poly.length >= 3 ? poly : contour.slice(0, 3);
}

/** Kåsa algebraic least-squares circle fit. */
export function fitCircle(pts: Px[]): { cx: number; cy: number; r: number; residual: number } | null {
  const n = pts.length;
  if (n < 3) return null;
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= n;
  my /= n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of pts) {
    const u = p.x - mx, v = p.y - my;
    suu += u * u; svv += v * v; suv += u * v;
    suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const b1 = 0.5 * (suuu + suvv);
  const b2 = 0.5 * (svvv + svuu);
  const uc = (b1 * svv - b2 * suv) / det;
  const vc = (suu * b2 - suv * b1) / det;
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  let res = 0;
  for (const p of pts) res += (Math.hypot(p.x - mx - uc, p.y - my - vc) - r) ** 2;
  return { cx: mx + uc, cy: my + vc, r, residual: Math.sqrt(res / n) };
}

/**
 * Holes are background pixels the border flood fill cannot reach. Each enclosed region is
 * measured by area and by a circle fit through its boundary (pixel-edge midpoints).
 */
export function findHoles(part: Uint8Array, w: number, h: number, minArea: number): DetectedHole[] {
  const outside = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const seed = (p: number) => { if (!part[p] && !outside[p]) { outside[p] = 1; queue[tail++] = p; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w, y = (p / w) | 0;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }
  const seen = new Uint8Array(w * h);
  const holes: DetectedHole[] = [];
  for (let s = 0; s < part.length; s++) {
    if (part[s] || outside[s] || seen[s]) continue;
    head = 0; tail = 0;
    queue[tail++] = s;
    seen[s] = 1;
    let area = 0, sx = 0, sy = 0;
    const edge: Px[] = [];
    while (head < tail) {
      const p = queue[head++];
      const x = p % w, y = (p / w) | 0;
      area++; sx += x; sy += y;
      const nb: [number, number, number][] = [[x - 1, y, p - 1], [x + 1, y, p + 1], [x, y - 1, p - w], [x, y + 1, p + w]];
      for (const [nx, ny, q] of nb) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (part[q]) edge.push({ x: (x + nx) / 2, y: (y + ny) / 2 });
        else if (!seen[q] && !outside[q]) { seen[q] = 1; queue[tail++] = q; }
      }
    }
    if (area < minArea) continue;
    const dArea = 2 * Math.sqrt(area / Math.PI);
    const fit = fitCircle(edge);
    // Pixel-edge midpoints sit on the true boundary, so the fit radius needs no half-pixel bias.
    const good = fit && fit.residual < Math.max(1, fit.r * 0.15);
    holes.push({
      cx: good ? fit!.cx + 0.5 : sx / area + 0.5,
      cy: good ? fit!.cy + 0.5 : sy / area + 0.5,
      d: good ? fit!.r * 2 : dArea,
      dArea,
      residual: fit ? fit.residual : Infinity,
      fitted: !!good,
      area,
    });
  }
  return holes;
}

export function detect(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  opts: DetectOptions,
  onStage: (s: Stage) => void = () => {},
): Detection {
  onStage('grayscale');
  const gray = toGray(rgba, w, h);
  const hist = histogram(gray);
  onStage('threshold');
  const ot = otsu(hist);
  const t = opts.threshold ?? ot;
  const mask = new Uint8Array(w * h);
  let fg = 0;
  for (let i = 0; i < gray.length; i++) {
    const on = opts.invert ? gray[i] > t : gray[i] <= t;
    if (on) { mask[i] = 1; fg++; }
  }
  onStage('components');
  const comp = largestComponent(mask, w, h);
  if (comp.area < 64) throw new DetectionError('No part found. Check the threshold, or try inverting for a light part on a dark background.');
  onStage('boundary');
  const contour = traceBoundary(comp.mask, w, h);
  if (contour.length < 8) throw new DetectionError('The detected region is too small to trace.');
  onStage('simplify');
  // Shift boundary pixel centres to the pixel grid's centre so mm conversion is unbiased.
  const centred = contour.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  const polygon = simplifyClosed(centred, opts.epsilon);
  onStage('holes');
  const holes = findHoles(comp.mask, w, h, opts.minHoleArea);
  return {
    width: w,
    height: h,
    threshold: t,
    otsu: ot,
    histogram: hist,
    partArea: comp.area,
    contour: centred,
    polygon,
    holes,
    coverage: fg / (w * h),
  };
}
