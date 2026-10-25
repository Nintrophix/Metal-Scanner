import { describe, expect, it } from 'vitest';
import { computeToolpath, DEFAULT_MACHINING, generateGcode } from './gcode';
import { generateDxf, generateSvg } from './vector';
import { bbox, type Part } from '../geom/polygon';

const SQ: Part = {
  outline: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 40 }, { x: 0, y: 40 }],
  holes: [{ id: 'h1', x: 25, y: 20, d: 10 }],
};

describe('G-code', () => {
  const m = { ...DEFAULT_MACHINING, toolDiameter: 6, depth: 3, stepDown: 1 };
  const lines = generateGcode(SQ, m, 'test').code.trim().split('\n');

  it('has the standard preamble and ends with M30', () => {
    for (const code of ['G21', 'G90', 'G94', 'M3 S12000']) expect(lines.some((l) => l.startsWith(code))).toBe(true);
    expect(lines[lines.length - 1]).toBe('M30');
  });
  it('offsets the outline outside by the tool radius', () => {
    const b = bbox(computeToolpath(SQ, m).outline);
    [b.minX, b.minY, b.maxX, b.maxY].forEach((v, k) => expect(v).toBeCloseTo([-3, -3, 53, 43][k], 9));
  });
  it('cuts holes before the outline and bores to finished size', () => {
    const hole = lines.findIndex((l) => l.startsWith('(Hole H1'));
    expect(hole).toBeGreaterThan(0);
    expect(hole).toBeLessThan(lines.indexOf('(Outline)'));
    // bore path radius = 5 − 3 = 2, so the arc starts at X27
    expect(lines).toContain('G0 X27 Y20');
    expect(lines).toContain('G2 X23 Y20 I-2 J0 F800');
  });
  it('steps down to full depth and no further', () => {
    expect(lines.filter((l) => l.startsWith('G1 Z-3')).length).toBe(2);
    expect(lines.some((l) => /Z-4/.test(l))).toBe(false);
  });
  it('keeps every comment a single balanced pair of parentheses', () => {
    const named = generateGcode(SQ, m, 'bracket (rev B); left').code.split('\n');
    expect(named[0]).toBe('(Irontronics — bracket [rev B]  left)');
    for (const l of named) {
      const i = l.indexOf('(');
      if (i < 0) continue;
      expect(l.indexOf(')')).toBe(l.length - 1);
      expect(l.slice(i + 1, -1)).not.toMatch(/[()]/);
    }
  });
  it('peck drills when asked', () => {
    const d = generateGcode(SQ, { ...m, holeStrategy: 'drill', peck: 1.5 }, 't').code;
    expect(d).toMatch(/G1 Z-1.5 F200\nG0 Z1\nG1 Z-3 F200/);
  });
  it('laser mode switches the beam per cut and never moves Z', () => {
    const l = generateGcode(SQ, { ...m, mode: 'laser', toolDiameter: 0.2 }, 't').code;
    expect(l).not.toMatch(/ Z/);
    expect((l.match(/M3 S/g) ?? []).length).toBe(2);
  });
});

describe('vector exports', () => {
  it('DXF has one LINE per edge and one CIRCLE per hole', () => {
    const d = generateDxf(SQ);
    expect((d.match(/\nLINE\n/g) ?? []).length).toBe(4);
    expect((d.match(/\nCIRCLE\n/g) ?? []).length).toBe(1);
    expect(d.trim().endsWith('EOF')).toBe(true);
  });
  it('SVG is sized in millimetres', () => {
    const s = generateSvg(SQ);
    expect(s).toMatch(/width="54.0000mm" height="44.0000mm"/);
    expect(s).toMatch(/<circle cx="27.0000" cy="22.0000" r="5.0000"/);
  });
});
