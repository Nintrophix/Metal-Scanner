import { dist, distToPolygon, pointInPolygon, selfIntersections, type Part } from './polygon';
import type { MachiningSettings } from '../export/gcode';

export type Issue = {
  level: 'error' | 'warning';
  message: string;
  /** Feature the issue points at, so the UI can select it. */
  target?: { kind: 'hole'; id: string } | { kind: 'edge'; index: number };
};

const MIN_WEB_MM = 1;

export function validatePart(part: Part, m: MachiningSettings, calibrated: boolean): Issue[] {
  const issues: Issue[] = [];
  if (!calibrated) {
    issues.push({ level: 'error', message: 'Not calibrated. Dimensions are estimates in pixels; calibrate before exporting.' });
  }
  if (part.outline.length < 3) {
    issues.push({ level: 'error', message: 'Outline needs at least three vertices.' });
    return issues;
  }
  for (const [i, j] of selfIntersections(part.outline)) {
    issues.push({ level: 'error', message: `Outline crosses itself (edges ${i + 1} and ${j + 1}).`, target: { kind: 'edge', index: i } });
  }
  const n = part.outline.length;
  for (let i = 0; i < n; i++) {
    const l = dist(part.outline[i], part.outline[(i + 1) % n]);
    if (l < 0.05) issues.push({ level: 'warning', message: `Edge ${i + 1} is shorter than 0.05 mm.`, target: { kind: 'edge', index: i } });
  }
  part.holes.forEach((h, k) => {
    const name = `Hole H${k + 1}`;
    const target = { kind: 'hole' as const, id: h.id };
    if (!(h.d > 0)) {
      issues.push({ level: 'error', message: `${name} has no diameter.`, target });
      return;
    }
    if (!pointInPolygon(h, part.outline)) {
      issues.push({ level: 'error', message: `${name} centre is outside the outline.`, target });
      return;
    }
    const web = distToPolygon(h, part.outline) - h.d / 2;
    if (web < 0) issues.push({ level: 'error', message: `${name} breaks through the outline.`, target });
    else if (web < MIN_WEB_MM) issues.push({ level: 'warning', message: `${name} leaves only ${web.toFixed(2)} mm of material to the edge.`, target });
    if (m.mode === 'mill' && m.holeStrategy === 'bore' && h.d < m.toolDiameter) {
      issues.push({ level: 'error', message: `${name} (Ø${h.d.toFixed(2)}) is smaller than the ${m.toolDiameter} mm tool; it cannot be bored.`, target });
    }
    part.holes.slice(k + 1).forEach((o, kk) => {
      if (dist(h, o) < (h.d + o.d) / 2) {
        issues.push({ level: 'error', message: `${name} overlaps hole H${k + kk + 2}.`, target });
      }
    });
  });
  if (m.toolDiameter <= 0) issues.push({ level: 'error', message: 'Tool diameter must be greater than zero.' });
  if (m.mode === 'mill') {
    if (m.depth <= 0) issues.push({ level: 'error', message: 'Cut depth must be greater than zero.' });
    if (m.stepDown <= 0) issues.push({ level: 'error', message: 'Step-down must be greater than zero.' });
    if (m.safeZ <= 0) issues.push({ level: 'warning', message: 'Safe Z is at or below the stock surface.' });
  }
  if (m.feed <= 0) issues.push({ level: 'error', message: 'Feed rate must be greater than zero.' });
  return issues;
}
