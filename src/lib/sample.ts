// Synthetic sample photograph: a known bracket rendered as a dark plate on a light matte
// background with uneven lighting and sensor noise. It exists so the pipeline can be tried
// (and tested) without a camera. Everything derived from it goes through the real detector.
import { pointInPolygon, type Vec } from '../geom/polygon';

export const SAMPLE_PX_PER_MM = 6;
export const SAMPLE_WIDTH = 1100;
export const SAMPLE_HEIGHT = 760;

/** Ground truth in millimetres (y-up), used by tests and by nothing in the UI. */
export const SAMPLE_TRUTH = {
  outline: [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 120, y: 32 },
    { x: 64, y: 32 },
    { x: 64, y: 80 },
    { x: 10, y: 80 },
    { x: 0, y: 70 },
  ] as Vec[],
  holes: [
    { x: 12, y: 12, d: 6.6 },
    { x: 108, y: 16, d: 6.6 },
    { x: 50, y: 16, d: 8.5 },
    { x: 30, y: 54, d: 12 },
  ],
};

const ORIGIN = { x: 190, y: 120 }; // image px of the part's top-left (mm x=0, y=80)
const REF_BAR = { x: 190, y: 680, lengthMm: 100 };

/** Endpoints (image px) of the printed 100 mm reference bar, for two-point calibration. */
export const SAMPLE_REFERENCE = {
  a: { x: REF_BAR.x, y: REF_BAR.y },
  b: { x: REF_BAR.x + REF_BAR.lengthMm * SAMPLE_PX_PER_MM, y: REF_BAR.y },
  mm: REF_BAR.lengthMm,
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function renderSampleRGBA(w = SAMPLE_WIDTH, h = SAMPLE_HEIGHT): Uint8ClampedArray {
  const s = SAMPLE_PX_PER_MM;
  const toMm = (px: number, py: number): Vec => ({ x: (px - ORIGIN.x) / s, y: 80 - (py - ORIGIN.y) / s });
  const out = new Uint8ClampedArray(w * h * 4);
  const rand = rng(7);
  const SS = [0.25, 0.75];
  const inPart = (p: Vec) =>
    pointInPolygon(p, SAMPLE_TRUTH.outline) &&
    !SAMPLE_TRUTH.holes.some((c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 < (c.d / 2) ** 2);
  const inBar = (px: number, py: number) => {
    const { a, b } = SAMPLE_REFERENCE;
    if (py >= a.y - 1.5 && py <= a.y + 1.5 && px >= a.x && px <= b.x) return true;
    // end ticks
    return (Math.abs(px - a.x - 1) <= 1.5 || Math.abs(px - b.x + 1) <= 1.5) && py >= a.y - 12 && py <= a.y + 12;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let cover = 0;
      for (const oy of SS) for (const ox of SS) {
        const px = x + ox, py = y + oy;
        if (inPart(toMm(px, py)) || inBar(px, py)) cover++;
      }
      cover /= 4;
      // Light, slightly vignetted backdrop; brushed-steel plate with a soft sheen.
      const vign = 1 - 0.12 * (((x - w / 2) / w) ** 2 + ((y - h / 2) / h) ** 2) * 4;
      const bg = 226 * vign;
      const plate = 62 + 18 * Math.sin((x + y) / 140) + 6 * Math.sin(y * 0.9);
      const noise = (rand() - 0.5) * 10;
      const v = bg * (1 - cover) + plate * cover + noise;
      const i = (y * w + x) * 4;
      out[i] = v + 2;
      out[i + 1] = v + 2;
      out[i + 2] = v + 5;
      out[i + 3] = 255;
    }
  }
  return out;
}
