import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { useStore, shownPart, unitOf, worldPerProcPx } from '../../state/store';
import { Drawing, Pill, toScreen, toWorld, type ViewXf } from './Drawing';
import { bbox, dist, partBBox, pointInPolygon, type Part, type Vec } from '../../geom/polygon';
import { addHole, insertVertex, moveVertex, updateHole } from '../../geom/edit';
import { computeToolpath } from '../../export/gcode';
import { pxToWorld, worldToPx, type Frame } from '../../state/convert';
import { fmtShort } from '../../lib/units';

export const MM_PER_CSS_PX_100 = 25.4 / 96;

type Drag =
  | { kind: 'pan'; start: Vec; view: ViewXf; moved: boolean; empty?: boolean }
  | { kind: 'vertex'; index: number; start: Vec; base: Part; moved: boolean }
  | { kind: 'hole'; id: string; start: Vec; base: Part; offset: Vec; moved: boolean };

export type ViewportApi = { fit: () => void; zoomTo: (pct: number) => void; zoomBy: (f: number) => void };

export function Viewport({ onCursor, apiRef, onZoom }: { onCursor: (p: Vec | null) => void; apiRef: React.MutableRefObject<ViewportApi | null>; onZoom: (pct: number) => void }) {
  const { state, dispatch } = useStore();
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<ViewXf>({ z: 4, tx: 100, ty: 500 });
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null);
  const [cursor, setCursorLocal] = useState<Vec | null>(null);
  const drag = useRef<Drag | null>(null);
  const spaceDown = useRef(false);
  const fitted = useRef<string>('');

  const part = shownPart(state);
  const units = unitOf(state);
  const src = state.source;
  const calibrated = !!state.calibration;

  // Image-to-world frame; before detection the image sits at the origin.
  const frame: Frame | null = useMemo(() => {
    if (state.frame) return state.frame;
    if (!src) return null;
    return { k: worldPerProcPx(src, state.calibration), ox: 0, oy: 0, H: src.proc.height };
  }, [state.frame, src, state.calibration]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const contentBounds = useCallback(() => {
    if (part && state.stage !== 'scan') return partBBox(part);
    if (src && frame) {
      const a = pxToWorld(frame, { x: 0, y: 0 });
      const b = pxToWorld(frame, { x: src.proc.width, y: src.proc.height });
      return bbox([a, b]);
    }
    return null;
  }, [part, state.stage, src, frame]);

  const fit = useCallback(() => {
    const b = contentBounds();
    if (!b) return;
    const pad = state.stage === 'scan' ? 40 : 110;
    const w = Math.max(1e-6, b.maxX - b.minX);
    const h = Math.max(1e-6, b.maxY - b.minY);
    const z = Math.min((size.w - pad * 2) / w, (size.h - pad * 2) / h);
    setView({ z, tx: size.w / 2 - ((b.minX + b.maxX) / 2) * z, ty: size.h / 2 + ((b.minY + b.maxY) / 2) * z });
  }, [contentBounds, size, state.stage]);

  // Refit when the content identity changes (new source, new detection, stage switch, calibration).
  useEffect(() => {
    const key = `${src?.url}|${state.stage === 'scan'}|${state.frame?.k}|${state.detect.status === 'done'}|${size.w > 0}`;
    if (key !== fitted.current && size.w > 0) {
      fitted.current = key;
      fit();
    }
  }, [src?.url, state.stage, state.frame?.k, state.detect.status, size.w, fit]);

  const pctPerZ = calibrated ? 100 * MM_PER_CSS_PX_100 : 100;
  useEffect(() => onZoom(view.z * pctPerZ), [view.z, pctPerZ, onZoom]);

  const zoomAround = useCallback((factor: number, at: Vec) => {
    setView((v) => {
      const z = Math.min(Math.max(v.z * factor, 0.02), 400);
      const f = z / v.z;
      return { z, tx: at.x - (at.x - v.tx) * f, ty: at.y - (at.y - v.ty) * f };
    });
  }, []);

  useEffect(() => {
    apiRef.current = {
      fit,
      zoomTo: (pct) => zoomAround(pct / pctPerZ / view.z, { x: size.w / 2, y: size.h / 2 }),
      zoomBy: (f) => zoomAround(f, { x: size.w / 2, y: size.h / 2 }),
    };
  }, [apiRef, fit, zoomAround, pctPerZ, view.z, size]);

  // Wheel zoom must be non-passive to prevent page zoom/scroll.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (e.ctrlKey || !e.shiftKey) zoomAround(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), at);
      else setView((v) => ({ ...v, tx: v.tx - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAround]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) spaceDown.current = true; };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** Snap targets for measuring: vertices and hole centres within 9 px. */
  const snapPoint = (s: Vec): Vec => {
    const w = toWorld(view, s);
    if (!part) return w;
    let best: Vec | null = null, bd = 9;
    for (const p of [...part.outline, ...part.holes]) {
      const d = dist(toScreen(view, p), s);
      if (d < bd) { bd = d; best = { x: p.x, y: p.y }; }
    }
    return best ?? w;
  };

  const editable = state.stage === 'edit' && state.view === 'plan';

  const onPointerDown = (e: RPE<SVGSVGElement>) => {
    if (e.button === 2) return;
    const s = local(e);
    const target = e.target as SVGElement;
    const hit = target.dataset.hit;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    const tool = state.tool;

    if (e.button === 1 || tool === 'pan' || spaceDown.current) {
      drag.current = { kind: 'pan', start: s, view, moved: false };
      return;
    }
    if (tool === 'calibrate' && frame && src) {
      const px = worldToPx(frame, toWorld(view, s));
      const pts = state.calPoints.length >= 2 ? [px] : [...state.calPoints, px];
      dispatch({ type: 'setCalPoints', points: pts });
      return;
    }
    if (tool === 'measure') {
      const p = snapPoint(s);
      const pts = state.measurePoints.length >= 2 ? [p] : [...state.measurePoints, p];
      dispatch({ type: 'setMeasurePoints', points: pts });
      return;
    }
    if (tool === 'hole' && part && editable) {
      const w = toWorld(view, s);
      if (!pointInPolygon(w, part.outline)) {
        dispatch({ type: 'toast', text: 'Place holes inside the outline.', tone: 'err' });
        return;
      }
      const last = part.holes[part.holes.length - 1];
      const id = `h${Date.now().toString(36)}`;
      dispatch({ type: 'commit', part: addHole(part, { id, x: round(w.x), y: round(w.y), d: last?.d ?? 6.6 }), label: 'Add hole', selection: { kind: 'hole', id } });
      return;
    }
    if (!part) {
      drag.current = { kind: 'pan', start: s, view, moved: false };
      return;
    }
    if (hit === 'vertex' && editable) {
      const index = Number(target.dataset.index);
      dispatch({ type: 'select', selection: { kind: 'vertex', index } });
      drag.current = { kind: 'vertex', index, start: s, base: part, moved: false };
      return;
    }
    if (hit === 'hole') {
      const id = target.dataset.id!;
      dispatch({ type: 'select', selection: { kind: 'hole', id } });
      if (editable) {
        const h = part.holes.find((x) => x.id === id)!;
        const w = toWorld(view, s);
        drag.current = { kind: 'hole', id, start: s, base: part, offset: { x: h.x - w.x, y: h.y - w.y }, moved: false };
      }
      return;
    }
    if (hit === 'edge') {
      dispatch({ type: 'select', selection: { kind: 'edge', index: Number(target.dataset.index) } });
      return;
    }
    if (hit === 'part') {
      dispatch({ type: 'select', selection: { kind: 'part' } });
      drag.current = { kind: 'pan', start: s, view, moved: false };
      return;
    }
    // Empty canvas: drag pans, a plain click clears the selection.
    drag.current = { kind: 'pan', start: s, view, moved: false, empty: true };
  };

  const onPointerMove = (e: RPE<SVGSVGElement>) => {
    const s = local(e);
    const w = toWorld(view, s);
    setCursorLocal(w);
    onCursor(w);
    const d = drag.current;
    if (!d) {
      const t = e.target as SVGElement;
      setHoverEdge(t.dataset.hit === 'edge' ? Number(t.dataset.index) : null);
      return;
    }
    if (!d.moved && dist(s, d.start) < 3) return;
    d.moved = true;
    if (d.kind === 'pan') {
      setView({ ...d.view, tx: d.view.tx + s.x - d.start.x, ty: d.view.ty + s.y - d.start.y });
    } else if (d.kind === 'vertex') {
      const n = d.base.outline.length;
      const nb = [d.base.outline[(d.index - 1 + n) % n], d.base.outline[(d.index + 1) % n]];
      let x = w.x, y = w.y;
      const g: { x?: number; y?: number } = {};
      if (!e.altKey) {
        for (const q of nb) {
          if (Math.abs(q.x - x) * view.z < 7) { x = q.x; g.x = q.x; }
          if (Math.abs(q.y - y) * view.z < 7) { y = q.y; g.y = q.y; }
        }
      }
      setGuides(g.x != null || g.y != null ? g : null);
      dispatch({ type: 'draft', part: moveVertex(d.base, d.index, { x: g.x ?? round(x), y: g.y ?? round(y) }) });
    } else if (d.kind === 'hole') {
      dispatch({ type: 'draft', part: updateHole(d.base, d.id, { x: round(w.x + d.offset.x), y: round(w.y + d.offset.y) }) });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setGuides(null);
    if (!d) return;
    if (d.kind === 'pan' && d.empty && !d.moved && state.tool === 'select' && state.selection) {
      dispatch({ type: 'select', selection: null });
    }
    if ((d.kind === 'vertex' || d.kind === 'hole') && d.moved && state.draft) {
      const label = d.kind === 'vertex' ? `Move vertex V${d.index + 1}` : `Move hole ${holeName(d.base, d.id)}`;
      dispatch({ type: 'commit', part: state.draft, label });
    }
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const t = e.target as SVGElement;
    if (!part || !editable || t.dataset.hit !== 'edge') return;
    const i = Number(t.dataset.index);
    const a = part.outline[i], b = part.outline[(i + 1) % part.outline.length];
    const w = toWorld(view, local(e));
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const tt = Math.max(0.05, Math.min(0.95, ((w.x - a.x) * ab.x + (w.y - a.y) * ab.y) / (ab.x ** 2 + ab.y ** 2)));
    dispatch({ type: 'commit', part: insertVertex(part, i, tt), label: `Insert vertex on edge E${i + 1}`, selection: { kind: 'vertex', index: i + 1 } });
  };

  const sel = state.selection;
  const toolpath = useMemo(() => (state.stage === 'export' && part && part.outline.length > 2 ? computeToolpath(part, state.machining) : null), [state.stage, part, state.machining]);
  const contour = useMemo(() => {
    if (state.stage !== 'scan' || !state.detect.result || !state.frame) return null;
    return state.detect.result.contour.map((p) => pxToWorld(state.frame!, p));
  }, [state.stage, state.detect.result, state.frame]);

  const cursorStyle = state.tool === 'pan' ? 'grab' : state.tool === 'select' ? 'default' : 'crosshair';
  const imageOpacity = state.stage === 'scan' ? 1 : state.imageOpacity;

  return (
    <div ref={wrap} className="viewport" style={{ cursor: cursorStyle }}>
      <svg
        width={size.w}
        height={size.h}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { setCursorLocal(null); onCursor(null); setHoverEdge(null); }}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Part plan view. Scroll to zoom, drag to pan."
      >
        <Drawing
          width={size.w}
          height={size.h}
          view={view}
          part={state.stage === 'scan' && state.detect.status !== 'done' ? null : part}
          units={units}
          original={state.original}
          compare={state.compare && state.stage !== 'scan'}
          image={src && frame && imageOpacity > 0 ? { url: src.url, w: src.proc.width, h: src.proc.height, frame, opacity: imageOpacity } : null}
          contour={contour}
          toolpath={toolpath}
          showVertices={editable && state.tool === 'select'}
          showEdgeLabels={state.stage !== 'scan'}
          selectedEdge={sel?.kind === 'edge' ? sel.index : null}
          hoverEdge={hoverEdge}
          selectedVertex={sel?.kind === 'vertex' ? sel.index : null}
          selectedHole={sel?.kind === 'hole' ? sel.id : null}
          guides={guides}
        >
          {state.tool === 'measure' && <MeasureOverlay view={view} points={state.measurePoints} cursor={cursor} units={units} snap={snapPoint} />}
          {state.tool === 'calibrate' && frame && src && <CalOverlay view={view} frame={frame} points={state.calPoints} cursor={cursor} procScale={src.procScale} />}
        </Drawing>
      </svg>
    </div>
  );
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const holeName = (p: Part, id: string) => `H${p.holes.findIndex((h) => h.id === id) + 1}`;

function MeasureOverlay({ view, points, cursor, units, snap }: { view: ViewXf; points: Vec[]; cursor: Vec | null; units: ReturnType<typeof unitOf>; snap: (s: Vec) => Vec }) {
  const pts = [...points];
  if (pts.length === 1 && cursor) pts.push(snap(toScreen(view, cursor)));
  const s = pts.map((p) => toScreen(view, p));
  return (
    <g style={{ pointerEvents: 'none' }}>
      {s.length === 2 && (
        <>
          <line x1={s[0].x} y1={s[0].y} x2={s[1].x} y2={s[1].y} stroke="var(--accent)" strokeWidth={1.25} />
          <Pill x={(s[0].x + s[1].x) / 2} y={(s[0].y + s[1].y) / 2 - 14} text={`${fmtShort(dist(pts[0], pts[1]), units)}  Δx ${fmtShort(Math.abs(pts[1].x - pts[0].x), units)}  Δy ${fmtShort(Math.abs(pts[1].y - pts[0].y), units)}`} />
        </>
      )}
      {s.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--surface)" stroke="var(--accent)" strokeWidth={1.5} />
      ))}
    </g>
  );
}

function CalOverlay({ view, frame, points, cursor, procScale }: { view: ViewXf; frame: Frame; points: Vec[]; cursor: Vec | null; procScale: number }) {
  const pts = points.map((p) => pxToWorld(frame, p));
  if (pts.length === 1 && cursor) pts.push(cursor);
  const s = pts.map((p) => toScreen(view, p));
  // Report source-image pixels, matching the Calibration panel.
  const pxLen = pts.length === 2 ? dist(worldToPx(frame, pts[0]), worldToPx(frame, pts[1])) / procScale : 0;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {s.length === 2 && (
        <>
          <line x1={s[0].x} y1={s[0].y} x2={s[1].x} y2={s[1].y} stroke="var(--red)" strokeWidth={1.5} />
          <Pill x={(s[0].x + s[1].x) / 2} y={(s[0].y + s[1].y) / 2 - 16} text={`${pxLen.toFixed(1)} px`} tone="red" />
        </>
      )}
      {s.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill="none" stroke="var(--red)" strokeWidth={1.5} />
          <line x1={p.x - 9} x2={p.x + 9} y1={p.y} y2={p.y} stroke="var(--red)" />
          <line y1={p.y - 9} y2={p.y + 9} x1={p.x} x2={p.x} stroke="var(--red)" />
        </g>
      ))}
    </g>
  );
}
