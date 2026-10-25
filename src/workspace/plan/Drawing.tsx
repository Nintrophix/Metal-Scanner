// Pure SVG renderer for the plan view. Geometry is projected to screen space in JS so strokes,
// pills, and labels keep constant on-screen size at every zoom level.
import { Fragment, type ReactNode } from 'react';
import { bbox, dist, interiorAngle, pointInPolygon, signedArea, type Part, type Vec } from '../../geom/polygon';
import type { Toolpath } from '../../export/gcode';
import type { Frame } from '../../state/convert';
import { fmtShort, type LengthUnit } from '../../lib/units';

export type ViewXf = { z: number; tx: number; ty: number };

export const toScreen = (v: ViewXf, p: Vec): Vec => ({ x: v.tx + p.x * v.z, y: v.ty - p.y * v.z });
export const toWorld = (v: ViewXf, s: Vec): Vec => ({ x: (s.x - v.tx) / v.z, y: (v.ty - s.y) / v.z });

const PILL_H = 18;
const pillW = (t: string) => t.length * 6.3 + 14;

/** Dimension label. `outline` marks reference (overall) dimensions so they read apart from edge lengths. */
export function Pill({ x, y, text, tone = 'accent', title }: { x: number; y: number; text: string; tone?: 'accent' | 'red' | 'outline'; title?: string }) {
  const w = pillW(text);
  const fill = tone === 'red' ? 'var(--red)' : tone === 'outline' ? 'var(--surface)' : 'var(--accent)';
  return (
    <g transform={`translate(${x - w / 2},${y - PILL_H / 2})`} style={{ pointerEvents: 'none' }}>
      {title && <title>{title}</title>}
      <rect width={w} height={PILL_H} rx={PILL_H / 2} fill={fill} stroke={tone === 'outline' ? 'var(--accent)' : 'none'} />
      <text x={w / 2} y={12.6} textAnchor="middle" fill={tone === 'outline' ? 'var(--accent-ink)' : '#fff'} fontFamily="var(--font-mono)" fontSize={10.5} fontWeight={500}>
        {text}
      </text>
    </g>
  );
}

function DatumBubble({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle cx={x} cy={y} r={9} fill="var(--surface-sunk)" stroke="var(--border-strong)" />
      <text x={x} y={y + 3.6} textAnchor="middle" fontSize={10} fontWeight={500} fill="var(--text-2)">
        {label}
      </text>
    </g>
  );
}

function partPath(v: ViewXf, part: Part): string {
  const pts = part.outline.map((p) => toScreen(v, p));
  let d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('') + 'Z';
  for (const h of part.holes) {
    const c = toScreen(v, h);
    const r = (h.d / 2) * v.z;
    d += `M${(c.x + r).toFixed(2)} ${c.y.toFixed(2)}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;
  }
  return d;
}

/** Outward screen-space normal for edge i of a CCW (y-up) polygon. */
function edgeNormal(v: ViewXf, poly: Vec[], i: number) {
  const a = toScreen(v, poly[i]);
  const b = toScreen(v, poly[(i + 1) % poly.length]);
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  // World outward normal of a CCW edge is (dy, -dx); with screen y flipped that becomes (-dy, dx).
  const ccw = signedArea(poly) > 0 ? 1 : -1;
  return { a, b, len: l, nx: (-dy / l) * ccw, ny: (dx / l) * ccw };
}

function AngleArc({ v, poly, i }: { v: ViewXf; poly: Vec[]; i: number }) {
  const n = poly.length;
  const c = toScreen(v, poly[i]);
  const q = toScreen(v, poly[(i + 1) % n]);
  const p = toScreen(v, poly[(i - 1 + n) % n]);
  const ang = interiorAngle(poly, i);
  const r = Math.min(46, dist(c, p) * 0.45, dist(c, q) * 0.45);
  if (r < 10) return null;
  const sweep = (ang * Math.PI) / 180;
  const start = Math.atan2(q.y - c.y, q.x - c.x);
  // Sweep toward whichever side the interior lies on: probe the bisector in world space.
  const probe = (dir: number) => {
    const m = start + (dir * sweep) / 2;
    const w = toWorld(v, { x: c.x + Math.cos(m) * 4, y: c.y + Math.sin(m) * 4 });
    return pointInPolygon(w, poly);
  };
  const dir = probe(1) ? 1 : -1;
  const end = start + dir * sweep;
  const s = { x: c.x + r * Math.cos(start), y: c.y + r * Math.sin(start) };
  const e = { x: c.x + r * Math.cos(end), y: c.y + r * Math.sin(end) };
  const mid = (start + end) / 2;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <path d={`M${s.x} ${s.y}A${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} ${dir > 0 ? 1 : 0} ${e.x} ${e.y}`} fill="none" stroke="var(--red)" strokeWidth={1} strokeDasharray="3 3" />
      <Pill x={c.x + (r + 16) * Math.cos(mid)} y={c.y + (r + 16) * Math.sin(mid)} text={`${ang.toFixed(Math.abs(ang - Math.round(ang)) < 0.05 ? 0 : 1)}°`} tone="red" />
    </g>
  );
}

export type DrawingProps = {
  width: number;
  height: number;
  view: ViewXf;
  part: Part | null;
  units: LengthUnit;
  original?: Part | null;
  compare?: boolean;
  image?: { url: string; w: number; h: number; frame: Frame; opacity: number } | null;
  contour?: Vec[] | null; // world units, raw trace
  toolpath?: Toolpath | null;
  showVertices?: boolean;
  showEdgeLabels?: boolean;
  showHoleLabels?: boolean;
  selectedEdge?: number | null;
  hoverEdge?: number | null;
  selectedVertex?: number | null;
  selectedHole?: string | null;
  guides?: { x?: number; y?: number } | null;
  children?: ReactNode;
};

export function Drawing(p: DrawingProps) {
  const { view: v, part } = p;
  const b = part ? bbox(part.outline) : null;
  const tl = b ? toScreen(v, { x: b.minX, y: b.maxY }) : null;
  const br = b ? toScreen(v, { x: b.maxX, y: b.minY }) : null;
  const n = part?.outline.length ?? 0;
  const dense = n > 48;
  const mid = tl && br ? { x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 } : null;

  // Label layout: edge pills first, then hole pills placed greedily on the first free diagonal.
  // A hole label that collides everywhere is dropped (the hole stays listed in the panel).
  type Rect = { x: number; y: number; w: number; h: number };
  const hit = (a: Rect, r: Rect) => Math.abs(a.x - r.x) * 2 < a.w + r.w + 4 && Math.abs(a.y - r.y) * 2 < a.h + r.h + 2;
  const taken: Rect[] = [];
  const edgeLabels: { i: number; x: number; y: number; text: string; sel: boolean }[] = [];
  if (part && p.showEdgeLabels !== false) {
    part.outline.forEach((_, i) => {
      const sel = p.selectedEdge === i;
      if (dense && !sel && p.hoverEdge !== i) return;
      const e = edgeNormal(v, part.outline, i);
      const text = fmtShort(dist(part.outline[i], part.outline[(i + 1) % n]), p.units);
      if (e.len < pillW(text) + 8 && !sel) return;
      const x = (e.a.x + e.b.x) / 2 + e.nx * 16;
      const y = (e.a.y + e.b.y) / 2 + e.ny * 16;
      edgeLabels.push({ i, x, y, text, sel });
      taken.push({ x, y, w: pillW(text), h: PILL_H });
    });
  }
  const holeLabels = new Map<string, { x: number; y: number; text: string }>();
  if (part && p.showHoleLabels !== false) {
    for (const h of part.holes) {
      const c = toScreen(v, h);
      const r = (h.d / 2) * v.z;
      if (r <= 3) continue;
      const text = 'Ø' + fmtShort(h.d, p.units);
      const w = pillW(text);
      const sx0 = mid && mid.x < c.x ? -1 : 1;
      const sy0 = mid && mid.y < c.y ? -1 : 1;
      const tries = [[sx0, sy0], [-sx0, sy0], [sx0, -sy0], [-sx0, -sy0]];
      for (const [sx, sy] of tries) {
        const cand = { x: c.x + sx * (r * 0.71 + w / 2 + 2), y: c.y + sy * (r * 0.71 + 10), w, h: PILL_H };
        if (!taken.some((t) => hit(cand, t))) {
          taken.push(cand);
          holeLabels.set(h.id, { x: cand.x, y: cand.y, text });
          break;
        }
      }
    }
  }

  return (
    <>
      {p.image && (
        <image
          href={p.image.url}
          width={p.image.w}
          height={p.image.h}
          preserveAspectRatio="none"
          opacity={p.image.opacity}
          transform={`matrix(${p.image.frame.k * v.z},0,0,${p.image.frame.k * v.z},${v.tx - p.image.frame.ox * v.z},${v.ty - (p.image.frame.H * p.image.frame.k - p.image.frame.oy) * v.z})`}
          style={{ pointerEvents: 'none', imageRendering: v.z * p.image.frame.k > 3 ? 'pixelated' : 'auto' }}
        />
      )}

      {tl && br && b && (
        <g style={{ pointerEvents: 'none' }}>
          {[tl.x, br.x].map((x, i) => (
            <line key={`v${i}`} x1={x} x2={x} y1={0} y2={p.height} stroke="var(--datum)" strokeDasharray="5 5" strokeWidth={1} />
          ))}
          {[tl.y, br.y].map((y, i) => (
            <line key={`h${i}`} y1={y} y2={y} x1={0} x2={p.width} stroke="var(--datum)" strokeDasharray="5 5" strokeWidth={1} />
          ))}
          <DatumBubble x={tl.x} y={Math.max(18, tl.y - 56)} label="1" />
          <DatumBubble x={br.x} y={Math.max(18, tl.y - 56)} label="2" />
          <DatumBubble x={Math.max(18, tl.x - 56)} y={tl.y} label="A" />
          <DatumBubble x={Math.max(18, tl.x - 56)} y={br.y} label="B" />
        </g>
      )}

      {p.compare && p.original && (
        <g style={{ pointerEvents: 'none' }} fill="none" stroke="var(--ghost)" strokeWidth={1} strokeDasharray="4 3">
          <path d={partPath(v, { outline: p.original.outline, holes: [] })} />
          {p.original.holes.map((h) => {
            const c = toScreen(v, h);
            return <circle key={h.id} cx={c.x} cy={c.y} r={(h.d / 2) * v.z} />;
          })}
        </g>
      )}

      {part && (
        <path
          d={partPath(v, part)}
          fillRule="evenodd"
          fill="var(--metal)"
          fillOpacity={p.image ? 0.72 : 1}
          stroke="var(--metal-edge-strong)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          data-hit="part"
        />
      )}

      {p.contour && p.contour.length > 2 && (
        <polyline
          points={p.contour.map((q) => toScreen(v, q)).map((s) => `${s.x},${s.y}`).join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.5}
          strokeWidth={1}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {p.toolpath && (
        <g fill="none" stroke="var(--toolpath)" strokeWidth={1.25} style={{ pointerEvents: 'none' }}>
          <path d={p.toolpath.outline.map((q, i) => { const s = toScreen(v, q); return `${i ? 'L' : 'M'}${s.x} ${s.y}`; }).join('') + 'Z'} strokeDasharray="6 3" />
          {p.toolpath.holes.map((h) => {
            const c = toScreen(v, h);
            return h.r > 0 ? (
              <circle key={h.id} cx={c.x} cy={c.y} r={h.r * v.z} strokeDasharray="4 3" />
            ) : (
              <g key={h.id}>
                <circle cx={c.x} cy={c.y} r={3} fill="var(--toolpath)" />
              </g>
            );
          })}
          {(() => {
            const s = toScreen(v, p.toolpath.outline[0]);
            const t = toScreen(v, p.toolpath.outline[1 % p.toolpath.outline.length]);
            const a = Math.atan2(t.y - s.y, t.x - s.x);
            const m = { x: s.x + Math.cos(a) * Math.min(40, dist(s, t) / 2), y: s.y + Math.sin(a) * Math.min(40, dist(s, t) / 2) };
            return (
              <g>
                <circle cx={s.x} cy={s.y} r={4} fill="var(--surface)" strokeWidth={1.5} />
                <path d={`M${m.x - 7 * Math.cos(a - 0.45)} ${m.y - 7 * Math.sin(a - 0.45)}L${m.x} ${m.y}L${m.x - 7 * Math.cos(a + 0.45)} ${m.y - 7 * Math.sin(a + 0.45)}`} strokeWidth={1.5} />
              </g>
            );
          })()}
        </g>
      )}

      {part && (
        <g>
          {part.outline.map((_, i) => {
            const { a, b: bb } = edgeNormal(v, part.outline, i);
            const active = p.selectedEdge === i || p.hoverEdge === i;
            return (
              <Fragment key={i}>
                {active && <line x1={a.x} y1={a.y} x2={bb.x} y2={bb.y} stroke={p.selectedEdge === i ? 'var(--red)' : 'var(--accent)'} strokeWidth={2.5} style={{ pointerEvents: 'none' }} />}
                <line x1={a.x} y1={a.y} x2={bb.x} y2={bb.y} stroke="transparent" strokeWidth={12} data-hit="edge" data-index={i} style={{ cursor: 'pointer' }} />
              </Fragment>
            );
          })}
        </g>
      )}

      {part &&
        part.holes.map((h, k) => {
          const c = toScreen(v, h);
          const r = (h.d / 2) * v.z;
          const sel = p.selectedHole === h.id;
          const arm = Math.max(5, r + 4);
          return (
            <g key={h.id}>
              <g stroke={sel ? 'var(--red)' : 'var(--metal-edge)'} strokeWidth={1} style={{ pointerEvents: 'none' }}>
                <line x1={c.x - arm} x2={c.x + arm} y1={c.y} y2={c.y} strokeDasharray="2 2" />
                <line y1={c.y - arm} y2={c.y + arm} x1={c.x} x2={c.x} strokeDasharray="2 2" />
              </g>
              {sel && <circle cx={c.x} cy={c.y} r={r} fill="none" stroke="var(--red)" strokeWidth={2} style={{ pointerEvents: 'none' }} />}
              <circle cx={c.x} cy={c.y} r={Math.max(r, 6)} fill="transparent" data-hit="hole" data-id={h.id} style={{ cursor: 'pointer' }}>
                <title>{`H${k + 1}`}</title>
              </circle>
              {holeLabels.has(h.id) && <Pill x={holeLabels.get(h.id)!.x} y={holeLabels.get(h.id)!.y} text={holeLabels.get(h.id)!.text} tone={sel ? 'red' : 'accent'} />}
            </g>
          );
        })}

      {edgeLabels.map((l) => (
        <Pill key={l.i} x={l.x} y={l.y} text={l.text} tone={l.sel ? 'red' : 'accent'} />
      ))}

      {part && p.selectedEdge != null && p.selectedEdge < n && (
        <>
          <AngleArc v={v} poly={part.outline} i={p.selectedEdge} />
          <AngleArc v={v} poly={part.outline} i={(p.selectedEdge + 1) % n} />
        </>
      )}

      {/* Datum dimensions for the selected hole or vertex, drawn from datum 1 and datum B as in the reference. */}
      {part && b && (p.selectedHole || p.selectedVertex != null) && (() => {
        const h = p.selectedHole ? part.holes.find((x) => x.id === p.selectedHole) : part.outline[p.selectedVertex!];
        if (!h || (h.x - b.minX < 1e-6 && h.y - b.minY < 1e-6)) return null;
        const c = toScreen(v, h);
        const ox = toScreen(v, { x: b.minX, y: h.y });
        const oy = toScreen(v, { x: h.x, y: b.minY });
        return (
          <g style={{ pointerEvents: 'none' }}>
            {h.x - b.minX > 1e-6 && (
              <>
                <line x1={ox.x} y1={c.y} x2={c.x} y2={c.y} stroke="var(--red)" strokeWidth={1} />
                <Pill x={(ox.x + c.x) / 2} y={c.y - 12} text={fmtShort(h.x - b.minX, p.units)} tone="red" />
              </>
            )}
            {h.y - b.minY > 1e-6 && (
              <>
                <line x1={c.x} y1={oy.y} x2={c.x} y2={c.y} stroke="var(--red)" strokeWidth={1} />
                <Pill x={c.x + pillW(fmtShort(h.y - b.minY, p.units)) / 2 + 6} y={(oy.y + c.y) / 2} text={fmtShort(h.y - b.minY, p.units)} tone="red" />
              </>
            )}
          </g>
        );
      })()}

      {tl && br && b && (
        <g>
          {/* An overall dimension already shown by a single full-length edge pill is not repeated. */}
          {!edgeLabels.some((l) => l.text === fmtShort(b.maxX - b.minX, p.units) && Math.abs(part!.outline[l.i].y - part!.outline[(l.i + 1) % n].y) < 1e-6) && <Pill x={(tl.x + br.x) / 2} y={br.y + 46} text={fmtShort(b.maxX - b.minX, p.units)} tone="outline" title="Overall width" />}
          {!edgeLabels.some((l) => l.text === fmtShort(b.maxY - b.minY, p.units) && Math.abs(part!.outline[l.i].x - part!.outline[(l.i + 1) % n].x) < 1e-6) && <Pill x={br.x + 52 + pillW(fmtShort(b.maxY - b.minY, p.units)) / 2} y={(tl.y + br.y) / 2} text={fmtShort(b.maxY - b.minY, p.units)} tone="outline" title="Overall height" />}
        </g>
      )}

      {p.guides && (
        <g stroke="var(--accent)" strokeWidth={1} strokeDasharray="2 3" style={{ pointerEvents: 'none' }}>
          {p.guides.x != null && <line x1={toScreen(v, { x: p.guides.x, y: 0 }).x} x2={toScreen(v, { x: p.guides.x, y: 0 }).x} y1={0} y2={p.height} />}
          {p.guides.y != null && <line y1={toScreen(v, { x: 0, y: p.guides.y }).y} y2={toScreen(v, { x: 0, y: p.guides.y }).y} x1={0} x2={p.width} />}
        </g>
      )}

      {part && p.showVertices &&
        part.outline.map((q, i) => {
          const s = toScreen(v, q);
          const sel = p.selectedVertex === i;
          return (
            <rect
              key={i}
              x={s.x - 4}
              y={s.y - 4}
              width={8}
              height={8}
              rx={1.5}
              fill={sel ? 'var(--accent)' : 'var(--surface)'}
              stroke="var(--accent)"
              strokeWidth={1.25}
              data-hit="vertex"
              data-index={i}
              style={{ cursor: 'move' }}
            />
          );
        })}

      {p.children}
    </>
  );
}
