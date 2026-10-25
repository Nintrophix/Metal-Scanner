import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDot, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useStore, shownPart, unitOf } from '../state/store';
import { Section, Row, Readout, LengthField, NumberField, Seg, Empty } from './ui';
import { area, bbox, dist, interiorAngle, perimeter, type Part } from '../geom/polygon';
import { deleteHole, deleteVertex, moveVertex, scalePart, setEdgeEndpoint, snapToGrid, squareUp, stretchEdge, stretchOverall, updateHole } from '../geom/edit';
import { validatePart } from '../geom/validate';
import { fmtLen, type LengthUnit } from '../lib/units';

/** ISO 273 medium-fit clearance holes. */
const CLEARANCE: [string, number][] = [['M3', 3.4], ['M4', 4.5], ['M5', 5.5], ['M6', 6.6], ['M8', 9], ['M10', 11], ['M12', 13.5]];

export function EditLeft() {
  const { state, dispatch } = useStore();
  const part = shownPart(state);
  const units = unitOf(state);
  const [tab, setTab] = useState<'outline' | 'holes'>('outline');
  const [tol, setTol] = useState(3);
  const [grid, setGrid] = useState(0.5);
  const [scalePct, setScalePct] = useState(100);
  const [scaleHoles, setScaleHoles] = useState(false);
  if (!part) return null;
  const sel = state.selection;
  const n = part.outline.length;

  return (
    <>
      <Section title="Features" flush>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'outline'} onClick={() => setTab('outline')}>
            Outline <span className="count">{n}</span>
          </button>
          <button role="tab" aria-selected={tab === 'holes'} onClick={() => setTab('holes')}>
            Holes <span className="count">{part.holes.length}</span>
          </button>
        </div>
        <div className="list" role="listbox" aria-label={tab === 'outline' ? 'Outline edges' : 'Holes'}>
          {tab === 'outline' &&
            part.outline.map((p, i) => {
              const l = dist(p, part.outline[(i + 1) % n]);
              const active = sel?.kind === 'edge' && sel.index === i;
              return (
                <button key={i} role="option" aria-selected={active} className="list-row" onClick={() => dispatch({ type: 'select', selection: { kind: 'edge', index: i } })}>
                  <span className="list-id">E{i + 1}</span>
                  <span className="list-sub">V{i + 1} → V{((i + 1) % n) + 1}</span>
                  <span className="num list-val">{fmtLen(l, units)}</span>
                </button>
              );
            })}
          {tab === 'holes' &&
            (part.holes.length ? (
              part.holes.map((h, i) => {
                const active = sel?.kind === 'hole' && sel.id === h.id;
                return (
                  <button key={h.id} role="option" aria-selected={active} className="list-row" onClick={() => dispatch({ type: 'select', selection: { kind: 'hole', id: h.id } })}>
                    <span className="list-id">H{i + 1}</span>
                    <span className="list-sub num">{fmtLen(h.x, units)}, {fmtLen(h.y, units)}</span>
                    <span className="num list-val">Ø{fmtLen(h.d, units)}</span>
                  </button>
                );
              })
            ) : (
              <Empty>No holes. Use Add hole (O) and click inside the outline.</Empty>
            ))}
        </div>
      </Section>

      <Section title="Clean up scan">
        <Row label="Square up" hint="Snaps edges within the tolerance of horizontal or vertical to exactly 0° or 90°.">
          <div className="inline">
            <NumberField value={tol} onCommit={setTol} suffix="°" min={0.1} max={15} step={0.5} label="Square-up tolerance" decimals={1} />
            <button className="btn" onClick={() => dispatch({ type: 'commit', part: squareUp(part, tol), label: `Square up (±${tol}°)` })}>
              Apply
            </button>
          </div>
        </Row>
        <Row label="Round to grid" hint="Rounds vertices, hole centres, and diameters.">
          <div className="inline">
            <LengthField value={grid} unit={units} onCommit={(v) => v > 0 && setGrid(v)} label="Grid step" />
            <button className="btn" onClick={() => dispatch({ type: 'commit', part: snapToGrid(part, grid), label: `Round to ${fmtLen(grid, units)} ${units}` })}>
              Apply
            </button>
          </div>
        </Row>
        <Row label="Scale">
          <div className="inline">
            <NumberField value={scalePct} onCommit={setScalePct} suffix="%" min={1} max={1000} step={1} label="Scale percentage" decimals={2} />
            <button className="btn" disabled={scalePct === 100} onClick={() => dispatch({ type: 'commit', part: scalePart(part, scalePct / 100, scaleHoles), label: `Scale ${scalePct}%` })}>
              Apply
            </button>
          </div>
        </Row>
        <label className="check" style={{ marginTop: 2 }}>
          <input type="checkbox" checked={scaleHoles} onChange={(e) => setScaleHoles(e.target.checked)} />
          Scale hole diameters too
        </label>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} disabled={!state.past.length} onClick={() => dispatch({ type: 'resetToScan' })}>
          <RotateCcw size={13} /> Revert to scan
        </button>
      </Section>
    </>
  );
}

export function EditRight() {
  const { state, dispatch } = useStore();
  const part = shownPart(state);
  const units = unitOf(state);
  const issues = useMemo(() => (part ? validatePart(part, state.machining, !!state.calibration) : []), [part, state.machining, state.calibration]);
  if (!part) return null;
  const commit = (p: Part, label: string) => dispatch({ type: 'commit', part: p, label });

  return (
    <>
      <Section title="Properties">
        <Properties part={part} units={units} commit={commit} />
      </Section>
      <Section title="Changes from scan" actions={<label className="check"><input type="checkbox" checked={state.compare} onChange={() => dispatch({ type: 'toggleCompare' })} /> Overlay</label>}>
        <Changes original={state.original} part={part} units={units} />
      </Section>
      <Section title="Checks">
        <IssueList issues={issues} />
      </Section>
    </>
  );
}

function Properties({ part, units, commit }: { part: Part; units: LengthUnit; commit: (p: Part, label: string) => void }) {
  const { state, dispatch } = useStore();
  const [mode, setMode] = useState<'stretch' | 'end'>('stretch');
  const sel = state.selection;
  const n = part.outline.length;
  const b = bbox(part.outline);

  if (sel?.kind === 'edge' && sel.index < n) {
    const i = sel.index;
    const a = part.outline[i];
    const c = part.outline[(i + 1) % n];
    const l = dist(a, c);
    const dir = (Math.atan2(c.y - a.y, c.x - a.x) * 180) / Math.PI;
    return (
      <div className="props">
        <div className="props-title"><span className="tag tag-accent">Edge E{i + 1}</span><span className="muted">V{i + 1} → V{((i + 1) % n) + 1}</span></div>
        <Row label="Length">
          <LengthField
            value={l}
            unit={units}
            label="Edge length"
            min={0.01}
            onCommit={(v) => commit(mode === 'stretch' ? stretchEdge(part, i, v) : setEdgeEndpoint(part, i, v), `Edge E${i + 1} to ${fmtLen(v, units)} ${units}`)}
          />
        </Row>
        <Row label="Resize by" hint={mode === 'stretch' ? 'Moves all geometry beyond the edge midpoint, keeping angles.' : `Moves only V${((i + 1) % n) + 1} along the edge; the next edge changes.`}>
          <Seg block value={mode} onChange={setMode} label="Resize mode" options={[{ value: 'stretch', label: 'Stretch' }, { value: 'end', label: 'End point' }]} />
        </Row>
        <Readout label="Direction" value={((dir + 360) % 360).toFixed(2)} unit="°" />
        <Readout label={`Angle at V${i + 1}`} value={interiorAngle(part.outline, i).toFixed(2)} unit="°" />
        <Readout label={`Angle at V${((i + 1) % n) + 1}`} value={interiorAngle(part.outline, (i + 1) % n).toFixed(2)} unit="°" />
        <p className="note">Double-click the edge on the canvas to insert a vertex.</p>
      </div>
    );
  }

  if (sel?.kind === 'vertex' && sel.index < n) {
    const i = sel.index;
    const p = part.outline[i];
    return (
      <div className="props">
        <div className="props-title"><span className="tag tag-accent">Vertex V{i + 1}</span></div>
        <div className="pair">
          <LengthField prefix="X" value={p.x - b.minX} unit={units} min={null} label="Vertex X" onCommit={(v) => commit(moveVertex(part, i, { x: v + b.minX, y: p.y }), `Vertex V${i + 1} X`)} />
          <LengthField prefix="Y" value={p.y - b.minY} unit={units} min={null} label="Vertex Y" onCommit={(v) => commit(moveVertex(part, i, { x: p.x, y: v + b.minY }), `Vertex V${i + 1} Y`)} />
        </div>
        <p className="note">Measured from datum 1 (left) and datum B (bottom).</p>
        <Readout label="Interior angle" value={interiorAngle(part.outline, i).toFixed(2)} unit="°" />
        <button className="btn btn-danger btn-block" disabled={n <= 3} onClick={() => dispatch({ type: 'commit', part: deleteVertex(part, i), label: `Delete vertex V${i + 1}`, selection: null })}>
          <Trash2 size={13} /> Delete vertex
        </button>
      </div>
    );
  }

  if (sel?.kind === 'hole') {
    const k = part.holes.findIndex((h) => h.id === sel.id);
    const h = part.holes[k];
    if (h) {
      const preset = CLEARANCE.find(([, d]) => Math.abs(d - h.d) < 1e-6)?.[0] ?? '';
      return (
        <div className="props">
          <div className="props-title"><span className="tag tag-accent"><CircleDot size={11} /> Hole H{k + 1}</span></div>
          <Row label="Diameter">
            <LengthField prefix="Ø" value={h.d} unit={units} min={0.01} label="Hole diameter" onCommit={(v) => commit(updateHole(part, h.id, { d: v }), `Hole H${k + 1} Ø${fmtLen(v, units)}`)} />
          </Row>
          {units !== 'px' && (
            <Row label="Clearance for">
              <label className="field">
                <select className="select" value={preset} aria-label="Clearance hole preset" onChange={(e) => {
                  const d = CLEARANCE.find(([m]) => m === e.target.value)?.[1];
                  if (d) commit(updateHole(part, h.id, { d }), `Hole H${k + 1} ${e.target.value} clearance`);
                }}>
                  <option value="">Custom</option>
                  {CLEARANCE.map(([m, d]) => (
                    <option key={m} value={m}>{m} · Ø{d} mm</option>
                  ))}
                </select>
              </label>
            </Row>
          )}
          <div className="pair">
            <LengthField prefix="X" value={h.x - b.minX} unit={units} min={null} label="Hole X" onCommit={(v) => commit(updateHole(part, h.id, { x: v + b.minX }), `Hole H${k + 1} X`)} />
            <LengthField prefix="Y" value={h.y - b.minY} unit={units} min={null} label="Hole Y" onCommit={(v) => commit(updateHole(part, h.id, { y: v + b.minY }), `Hole H${k + 1} Y`)} />
          </div>
          <p className="note">Centre measured from datum 1 (left) and datum B (bottom).</p>
          <button className="btn btn-danger btn-block" onClick={() => dispatch({ type: 'commit', part: deleteHole(part, h.id), label: `Delete hole H${k + 1}`, selection: null })}>
            <Trash2 size={13} /> Delete hole
          </button>
        </div>
      );
    }
  }

  return (
    <div className="props">
      <div className="props-title"><span className="tag">Part</span><span className="muted">{sel?.kind === 'part' ? 'Selected' : 'Select an edge, vertex, or hole to edit it'}</span></div>
      <Row label="Overall width" hint="Stretches about the centre line; holes beyond it move with the edge.">
        <LengthField value={b.maxX - b.minX} unit={units} min={0.01} label="Overall width" onCommit={(v) => commit(stretchOverall(part, 'x', v), `Width to ${fmtLen(v, units)} ${units}`)} />
      </Row>
      <Row label="Overall height">
        <LengthField value={b.maxY - b.minY} unit={units} min={0.01} label="Overall height" onCommit={(v) => commit(stretchOverall(part, 'y', v), `Height to ${fmtLen(v, units)} ${units}`)} />
      </Row>
      <Readout label="Area" value={units === 'in' ? (area(part.outline) / 645.16).toFixed(3) : area(part.outline).toFixed(units === 'px' ? 0 : 1)} unit={units === 'px' ? 'px²' : `${units}²`} />
      <Readout label="Perimeter" value={fmtLen(perimeter(part.outline), units)} unit={units} />
      <Readout label="Vertices" value={n} />
      <Readout label="Holes" value={part.holes.length} />
    </div>
  );
}

function Changes({ original, part, units }: { original: Part | null; part: Part; units: LengthUnit }) {
  if (!original) return null;
  const rows: { label: string; from: string; to: string }[] = [];
  const ob = bbox(original.outline), nb = bbox(part.outline);
  const cmp = (label: string, a: number, b: number, fmt = (v: number) => fmtLen(v, units)) => {
    if (Math.abs(a - b) > 1e-6) rows.push({ label, from: fmt(a), to: fmt(b) });
  };
  cmp('Width', ob.maxX - ob.minX, nb.maxX - nb.minX);
  cmp('Height', ob.maxY - ob.minY, nb.maxY - nb.minY);
  cmp('Perimeter', perimeter(original.outline), perimeter(part.outline));
  cmp('Area', area(original.outline), area(part.outline), (v) => (units === 'in' ? (v / 645.16).toFixed(3) : v.toFixed(1)));
  if (original.outline.length !== part.outline.length) rows.push({ label: 'Vertices', from: String(original.outline.length), to: String(part.outline.length) });
  const byId = new Map(original.holes.map((h) => [h.id, h]));
  part.holes.forEach((h, i) => {
    const o = byId.get(h.id);
    if (!o) rows.push({ label: `H${i + 1}`, from: 'new', to: `Ø${fmtLen(h.d, units)}` });
    else {
      if (Math.abs(o.d - h.d) > 1e-6) rows.push({ label: `H${i + 1} Ø`, from: fmtLen(o.d, units), to: fmtLen(h.d, units) });
      const moved = dist(o, h);
      if (moved > 1e-6) rows.push({ label: `H${i + 1} moved`, from: '', to: fmtLen(moved, units) });
    }
  });
  const removed = original.holes.filter((o) => !part.holes.some((h) => h.id === o.id)).length;
  if (removed) rows.push({ label: 'Holes removed', from: '', to: String(removed) });

  if (!rows.length) return <Empty>Geometry matches the scan.</Empty>;
  return (
    <table className="tbl tbl-changes">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.label}</td>
            <td className="num muted">{r.from}</td>
            <td className="num">{r.from ? '→ ' : ''}{r.to}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function IssueList({ issues }: { issues: ReturnType<typeof validatePart> }) {
  const { dispatch } = useStore();
  if (!issues.length) {
    return (
      <p className="issue issue-ok">
        <CheckCircle2 size={14} /> Geometry is valid for the current machining settings.
      </p>
    );
  }
  return (
    <ul className="issues">
      {issues.map((it, i) => (
        <li key={i}>
          <button
            className={`issue issue-${it.level}`}
            disabled={!it.target}
            onClick={() => it.target && dispatch({ type: 'select', selection: it.target.kind === 'hole' ? { kind: 'hole', id: it.target.id } : { kind: 'edge', index: it.target.index } })}
          >
            {it.level === 'error' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
            <span>{it.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
