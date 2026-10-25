import { describe, expect, it } from 'vitest';
import { detect, fitCircle, otsu, simplifyClosed, traceBoundary } from './pipeline';
import { renderSampleRGBA, SAMPLE_HEIGHT, SAMPLE_PX_PER_MM, SAMPLE_TRUTH, SAMPLE_WIDTH } from '../lib/sample';
import { detectionToPart } from '../state/convert';
import { area, bbox } from '../geom/polygon';

const OPTS = { threshold: null, invert: false, epsilon: 1.5, minHoleArea: 12 };

describe('otsu', () => {
  it('splits a bimodal histogram between the modes', () => {
    const hist = new Array(256).fill(0);
    hist[40] = 500;
    hist[210] = 1500;
    const t = otsu(hist);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(210);
  });
});

describe('traceBoundary', () => {
  it('traces a filled rectangle as a closed loop of its edge pixels', () => {
    const w = 10, h = 8;
    const m = new Uint8Array(w * h);
    for (let y = 2; y < 6; y++) for (let x = 3; x < 8; x++) m[y * w + x] = 1;
    const c = traceBoundary(m, w, h);
    expect(c.length).toBe(2 * (5 + 4) - 4);
    const poly = simplifyClosed(c, 0.5);
    expect(poly.length).toBe(4);
  });
});

describe('fitCircle', () => {
  it('recovers centre and radius', () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({ x: 5 + 3 * Math.cos(i), y: -2 + 3 * Math.sin(i) }));
    const f = fitCircle(pts)!;
    expect(f.cx).toBeCloseTo(5, 6);
    expect(f.cy).toBeCloseTo(-2, 6);
    expect(f.r).toBeCloseTo(3, 6);
  });
});

describe('detect on the synthetic sample', () => {
  const rgba = renderSampleRGBA();
  const det = detect(rgba, SAMPLE_WIDTH, SAMPLE_HEIGHT, OPTS);
  const { part } = detectionToPart(det, 1 / SAMPLE_PX_PER_MM);

  it('finds every hole within 0.15 mm of truth', () => {
    expect(part.holes).toHaveLength(SAMPLE_TRUTH.holes.length);
    for (const t of SAMPLE_TRUTH.holes) {
      const m = part.holes.find((h) => Math.hypot(h.x - t.x, h.y - t.y) < 0.5);
      expect(m, `hole at ${t.x},${t.y}`).toBeDefined();
      expect(Math.abs(m!.d - t.d)).toBeLessThan(0.15);
      expect(Math.hypot(m!.x - t.x, m!.y - t.y)).toBeLessThan(0.15);
    }
  });

  it('measures overall size within 0.2 mm and area within 0.5 %', () => {
    const b = bbox(part.outline);
    expect(Math.abs(b.maxX - b.minX - 120)).toBeLessThan(0.2);
    expect(Math.abs(b.maxY - b.minY - 80)).toBeLessThan(0.2);
    const truth = area(SAMPLE_TRUTH.outline);
    expect(Math.abs(area(part.outline) - truth) / truth).toBeLessThan(0.005);
  });

  it('simplifies to a compact polygon', () => {
    expect(part.outline.length).toBeGreaterThanOrEqual(7);
    expect(part.outline.length).toBeLessThanOrEqual(12);
  });
});
