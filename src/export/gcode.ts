// RS-274 / NGC G-code generation for mill and laser/plasma modes.
import { ensureCCW, offsetPolygon, perimeter, type Part, type Vec } from '../geom/polygon';

export type MachiningSettings = {
  mode: 'mill' | 'laser';
  /** Cutter diameter for mill mode, kerf width for laser/plasma. */
  toolDiameter: number;
  offset: 'outside' | 'on' | 'inside';
  holeStrategy: 'drill' | 'bore' | 'skip';
  feed: number;
  plunge: number;
  /** Spindle RPM (mill) or laser/torch power S-word. */
  spindle: number;
  safeZ: number;
  /** Total cut depth; also the stock thickness used by the 3D preview. */
  depth: number;
  stepDown: number;
  peck: number;
  /** Laser/plasma pierce dwell in seconds. */
  pierceDelay: number;
};

export const DEFAULT_MACHINING: MachiningSettings = {
  mode: 'mill',
  toolDiameter: 6,
  offset: 'outside',
  holeStrategy: 'bore',
  feed: 800,
  plunge: 200,
  spindle: 12000,
  safeZ: 5,
  depth: 3,
  stepDown: 1,
  peck: 1,
  pierceDelay: 0.5,
};

export type HolePath = { id: string; x: number; y: number; /** Path radius; 0 means plunge only. */ r: number; kind: 'drill' | 'bore' | 'laser' };

export type Toolpath = { outline: Vec[]; holes: HolePath[] };

export function computeToolpath(part: Part, m: MachiningSettings): Toolpath {
  const toolR = m.toolDiameter / 2;
  const sign = m.offset === 'outside' ? 1 : m.offset === 'inside' ? -1 : 0;
  const outline = offsetPolygon(ensureCCW(part.outline), sign * toolR);
  const holes: HolePath[] = [];
  if (m.holeStrategy !== 'skip' || m.mode === 'laser') {
    for (const h of part.holes) {
      if (m.mode === 'laser') {
        const r = h.d / 2 - (m.offset === 'on' ? 0 : toolR);
        holes.push({ id: h.id, x: h.x, y: h.y, r: Math.max(0, r), kind: 'laser' });
      } else if (m.holeStrategy === 'drill') {
        holes.push({ id: h.id, x: h.x, y: h.y, r: 0, kind: 'drill' });
      } else {
        holes.push({ id: h.id, x: h.x, y: h.y, r: Math.max(0, h.d / 2 - toolR), kind: 'bore' });
      }
    }
  }
  return { outline, holes };
}

const f = (v: number) => {
  const s = v.toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};

/** GRBL ends a comment at the first ')' and rejects nesting, so brackets replace parentheses. */
export const commentSafe = (t: string) => t.replace(/\(/g, '[').replace(/\)/g, ']').replace(/[\r\n;]/g, ' ');

export type GcodeResult = { code: string; lines: number; cutLength: number; estMinutes: number };

export function generateGcode(part: Part, m: MachiningSettings, name = 'part'): GcodeResult {
  const tp = computeToolpath(part, m);
  const out: string[] = [];
  const passes: number[] = [];
  if (m.mode === 'mill') {
    const steps = Math.max(1, Math.ceil(m.depth / m.stepDown - 1e-9));
    for (let k = 1; k <= steps; k++) passes.push(-Math.min(m.depth, k * m.stepDown));
  }
  let cutLength = 0;
  let plungeLength = 0;

  out.push(`(Irontronics — ${commentSafe(name)})`);
  out.push(`(Mode: ${m.mode === 'mill' ? 'mill' : 'laser/plasma'}, tool Ø${f(m.toolDiameter)} mm, offset ${m.offset})`);
  out.push(`(Holes: ${part.holes.length}, strategy ${m.mode === 'laser' ? 'cut' : m.holeStrategy})`);
  if (m.mode === 'mill') out.push('(Conventional milling with M3: outline counter-clockwise, holes clockwise)');
  out.push('G21 (millimetres)');
  out.push('G90 (absolute positioning)');
  out.push('G94 (feed per minute)');
  out.push('G17 (XY plane)');
  if (m.mode === 'mill') {
    out.push(`G0 Z${f(m.safeZ)}`);
    out.push(`M3 S${f(m.spindle)}`);
  } else {
    out.push('M5');
  }

  const circle = (x: number, y: number, r: number) => {
    // Full circle as two G2 half arcs: robust on controllers that reject 360° single arcs.
    out.push(`G2 X${f(x - r)} Y${f(y)} I${f(-r)} J0 F${f(m.feed)}`);
    out.push(`G2 X${f(x + r)} Y${f(y)} I${f(r)} J0`);
    cutLength += 2 * Math.PI * r;
  };

  tp.holes.forEach((h, idx) => {
    out.push(`(Hole H${idx + 1} at X${f(h.x)} Y${f(h.y)})`);
    if (h.kind === 'laser') {
      if (h.r <= 0) return;
      out.push(`G0 X${f(h.x + h.r)} Y${f(h.y)}`);
      out.push(`M3 S${f(m.spindle)}`);
      if (m.pierceDelay > 0) out.push(`G4 P${f(m.pierceDelay)}`);
      circle(h.x, h.y, h.r);
      out.push('M5');
    } else if (h.kind === 'drill' || h.r <= 0.001) {
      out.push(`G0 X${f(h.x)} Y${f(h.y)}`);
      const rPlane = Math.min(m.safeZ, 1);
      out.push(`G0 Z${f(rPlane)}`);
      let z = 0;
      while (z > -m.depth + 1e-9) {
        z = Math.max(-m.depth, z - m.peck);
        out.push(`G1 Z${f(z)} F${f(m.plunge)}`);
        out.push(`G0 Z${f(rPlane)}`);
      }
      plungeLength += m.depth;
      out.push(`G0 Z${f(m.safeZ)}`);
    } else {
      out.push(`G0 X${f(h.x + h.r)} Y${f(h.y)}`);
      out.push('G0 Z1');
      for (const z of passes) {
        out.push(`G1 Z${f(z)} F${f(m.plunge)}`);
        circle(h.x, h.y, h.r);
      }
      plungeLength += m.depth;
      out.push(`G0 Z${f(m.safeZ)}`);
    }
  });

  out.push('(Outline)');
  const loop = tp.outline;
  const start = loop[0];
  out.push(`G0 X${f(start.x)} Y${f(start.y)}`);
  const trace = () => {
    for (let i = 1; i <= loop.length; i++) {
      const p = loop[i % loop.length];
      out.push(i === 1 ? `G1 X${f(p.x)} Y${f(p.y)} F${f(m.feed)}` : `G1 X${f(p.x)} Y${f(p.y)}`);
    }
    cutLength += perimeter(loop);
  };
  if (m.mode === 'mill') {
    out.push('G0 Z1');
    for (const z of passes) {
      out.push(`G1 Z${f(z)} F${f(m.plunge)}`);
      trace();
    }
    plungeLength += m.depth;
    out.push(`G0 Z${f(m.safeZ)}`);
    out.push('M5');
  } else {
    out.push(`M3 S${f(m.spindle)}`);
    if (m.pierceDelay > 0) out.push(`G4 P${f(m.pierceDelay)}`);
    trace();
    out.push('M5');
  }
  out.push('G0 X0 Y0');
  out.push('M30');
  const code = out.join('\n') + '\n';
  const estMinutes = cutLength / m.feed + (m.mode === 'mill' ? plungeLength / m.plunge : 0);
  return { code, lines: out.length, cutLength, estMinutes };
}
