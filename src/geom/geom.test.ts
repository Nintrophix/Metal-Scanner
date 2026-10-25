import { describe, expect, it } from 'vitest';
import { area, bbox, dist, interiorAngle, offsetPolygon, selfIntersections, type Part } from './polygon';
import { deleteVertex, insertVertex, scalePart, setEdgeEndpoint, snapToGrid, squareUp, stretchEdge, stretchOverall } from './edit';
import { validatePart } from './validate';
import { DEFAULT_MACHINING } from '../export/gcode';

const L: Part = {
  outline: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 30 },
    { x: 40, y: 30 },
    { x: 40, y: 60 },
    { x: 0, y: 60 },
  ],
  holes: [
    { id: 'a', x: 10, y: 10, d: 6 },
    { id: 'b', x: 90, y: 15, d: 6 },
  ],
};

describe('polygon', () => {
  it('computes area and angles', () => {
    expect(area(L.outline)).toBe(100 * 30 + 40 * 30);
    expect(interiorAngle(L.outline, 0)).toBeCloseTo(90);
    expect(interiorAngle(L.outline, 3)).toBeCloseTo(270);
  });
  it('offsets a square outward and inward by d on every side', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const o = bbox(offsetPolygon(sq, 2));
    [o.minX, o.minY, o.maxX, o.maxY].forEach((v, k) => expect(v).toBeCloseTo([-2, -2, 12, 12][k], 9));
    const i = bbox(offsetPolygon(sq, -2));
    expect(i.minX).toBeCloseTo(2, 9);
    expect(i.maxX).toBeCloseTo(8, 9);
  });
  it('detects a bow-tie self-intersection', () => {
    expect(selfIntersections([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }]).length).toBe(1);
    expect(selfIntersections(L.outline)).toEqual([]);
  });
});

describe('edits change real geometry', () => {
  it('stretchEdge sets the edge length and keeps right angles', () => {
    const p = stretchEdge(L, 0, 130);
    expect(dist(p.outline[0], p.outline[1])).toBeCloseTo(130);
    for (let i = 0; i < p.outline.length; i++) expect([90, 270]).toContain(Math.round(interiorAngle(p.outline, i)));
    // The hole beyond the midpoint moves with the edge; the other stays.
    expect(p.holes.find((h) => h.id === 'b')!.x).toBeCloseTo(120);
    expect(p.holes.find((h) => h.id === 'a')!.x).toBeCloseTo(10);
  });
  it('setEdgeEndpoint moves only the end vertex', () => {
    const p = setEdgeEndpoint(L, 0, 80);
    expect(p.outline[1]).toEqual({ x: 80, y: 0 });
    expect(p.outline[2]).toEqual(L.outline[2]);
  });
  it('stretchOverall sets the bounding size', () => {
    const b = bbox(stretchOverall(L, 'y', 75).outline);
    expect(b.maxY - b.minY).toBeCloseTo(75);
  });
  it('scalePart scales positions and optionally diameters', () => {
    expect(scalePart(L, 2, false).holes[0].d).toBe(6);
    expect(scalePart(L, 2, true).holes[0].d).toBe(12);
    expect(bbox(scalePart(L, 2, false).outline).maxX).toBe(200);
  });
  it('squareUp removes small wobble', () => {
    const wobbly: Part = { ...L, outline: L.outline.map((p, i) => (i === 1 ? { x: 100, y: 0.8 } : p)) };
    const s = squareUp(wobbly, 3);
    expect(s.outline[0].y).toBeCloseTo(s.outline[1].y);
    expect(s.outline[1].x).toBeCloseTo(s.outline[2].x);
  });
  it('snapToGrid rounds to the step', () => {
    const p = snapToGrid({ outline: [{ x: 0.26, y: 0.74 }, { x: 10.1, y: 0 }, { x: 5, y: 9.9 }], holes: [] }, 0.5);
    expect(p.outline[0]).toEqual({ x: 0.5, y: 0.5 });
  });
  it('inserts and deletes vertices', () => {
    const p = insertVertex(L, 0, 0.5);
    expect(p.outline[1]).toEqual({ x: 50, y: 0 });
    expect(deleteVertex(p, 1).outline).toEqual(L.outline);
  });
});

describe('validatePart', () => {
  const m = DEFAULT_MACHINING;
  it('passes a valid calibrated part', () => {
    expect(validatePart(L, m, true)).toEqual([]);
  });
  it('blocks uncalibrated export', () => {
    expect(validatePart(L, m, false).some((i) => i.level === 'error')).toBe(true);
  });
  it('flags holes that break out, overlap, or cannot be bored', () => {
    const bad: Part = { ...L, holes: [{ id: 'x', x: 1, y: 10, d: 6 }, { id: 'y', x: 20, y: 10, d: 4 }, { id: 'z', x: 22, y: 10, d: 4 }] };
    const msgs = validatePart(bad, m, true).map((i) => i.message).join('\n');
    expect(msgs).toMatch(/breaks through/);
    expect(msgs).toMatch(/overlaps/);
    expect(msgs).toMatch(/cannot be bored/);
  });
});
