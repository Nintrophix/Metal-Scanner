// DXF (R12 ASCII) and SVG export of the part profile at 1:1 millimetre scale.
import { bbox, type Part } from '../geom/polygon';

const n = (v: number) => v.toFixed(4);

export function generateDxf(part: Part): string {
  const g: string[] = [];
  const pair = (code: number, value: string | number) => g.push(String(code), String(value));
  pair(0, 'SECTION');
  pair(2, 'HEADER');
  pair(9, '$ACADVER');
  pair(1, 'AC1009');
  pair(9, '$INSUNITS');
  pair(70, 4); // millimetres
  pair(0, 'ENDSEC');
  pair(0, 'SECTION');
  pair(2, 'TABLES');
  pair(0, 'TABLE');
  pair(2, 'LAYER');
  pair(70, 2);
  for (const [name, color] of [['OUTLINE', 7], ['HOLES', 1]] as const) {
    pair(0, 'LAYER');
    pair(2, name);
    pair(70, 0);
    pair(62, color);
    pair(6, 'CONTINUOUS');
  }
  pair(0, 'ENDTAB');
  pair(0, 'ENDSEC');
  pair(0, 'SECTION');
  pair(2, 'ENTITIES');
  const pts = part.outline;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    pair(0, 'LINE');
    pair(8, 'OUTLINE');
    pair(10, n(a.x));
    pair(20, n(a.y));
    pair(30, n(0));
    pair(11, n(b.x));
    pair(21, n(b.y));
    pair(31, n(0));
  }
  for (const h of part.holes) {
    pair(0, 'CIRCLE');
    pair(8, 'HOLES');
    pair(10, n(h.x));
    pair(20, n(h.y));
    pair(30, n(0));
    pair(40, n(h.d / 2));
  }
  pair(0, 'ENDSEC');
  pair(0, 'EOF');
  return g.join('\n') + '\n';
}

export function generateSvg(part: Part): string {
  const b = bbox(part.outline);
  const pad = 2;
  const w = b.maxX - b.minX + pad * 2;
  const h = b.maxY - b.minY + pad * 2;
  // SVG is y-down; flip about the bounding box so the drawing matches the part.
  const tx = (x: number) => n(x - b.minX + pad);
  const ty = (y: number) => n(b.maxY - y + pad);
  const d = part.outline.map((p, i) => `${i ? 'L' : 'M'}${tx(p.x)} ${ty(p.y)}`).join(' ') + ' Z';
  const circles = part.holes
    .map((c) => `  <circle cx="${tx(c.x)}" cy="${ty(c.y)}" r="${n(c.d / 2)}" />`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}mm" height="${n(h)}mm" viewBox="0 0 ${n(w)} ${n(h)}">
  <g fill="none" stroke="#000" stroke-width="0.1">
  <path d="${d}" />
${circles}
  </g>
</svg>
`;
}
