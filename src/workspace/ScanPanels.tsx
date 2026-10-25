import { useMemo, useState } from 'react';
import { ArrowRight, Camera, Crosshair, ImageUp, Scan, Trash2 } from 'lucide-react';
import { useStore, unitOf, type Calibration } from '../state/store';
import { Section, Row, Readout, NumberField, Empty } from './ui';
import { area, bbox, dist, perimeter } from '../geom/polygon';
import { fmtLen, parseLength } from '../lib/units';
import { SAMPLE_REFERENCE } from '../lib/sample';

export function ScanLeft({ onCamera, onUpload, onSample, cameraOpen }: { onCamera: () => void; onUpload: () => void; onSample: () => void; cameraOpen: boolean }) {
  const { state, dispatch } = useStore();
  const src = state.source;
  const opts = state.options;
  const det = state.detect.result;
  const edits = state.past.length;

  return (
    <>
      <Section title="Source">
        {src ? (
          <div className="src">
            <img src={src.url} alt="" className="src-thumb" />
            <div className="src-meta">
              <div className="src-name" title={src.name}>{src.name}</div>
              <div className="src-sub num">
                {src.width} × {src.height} px{src.procScale < 1 ? ` · analysed at ${src.proc.width} × ${src.proc.height}` : ''}
              </div>
            </div>
          </div>
        ) : (
          <Empty>No image yet. Capture one with the camera or open a photo.</Empty>
        )}
        <div className="btn-row btn-row-tight">
          <button className="btn" onClick={onCamera} aria-pressed={cameraOpen} title="Capture from a camera">
            <Camera size={13} /> Camera
          </button>
          <button className="btn" onClick={onUpload} title="Open a photo">
            <ImageUp size={13} /> Photo
          </button>
          <button className="btn" onClick={onSample} title="Load the synthetic sample photo">
            <Scan size={13} /> Sample
          </button>
        </div>
      </Section>

      <Section title="Detection">
        <Histogram hist={det?.histogram} threshold={opts.threshold ?? det?.otsu ?? 128} otsu={det?.otsu} invert={opts.invert} />
        <Row label="Threshold">
          <div className="inline">
            <input
              type="range"
              min={1}
              max={254}
              value={opts.threshold ?? det?.otsu ?? 128}
              onChange={(e) => dispatch({ type: 'setOptions', options: { threshold: Number(e.target.value) } })}
              aria-label="Threshold"
              disabled={!src}
            />
            <span className="num val">{opts.threshold ?? det?.otsu ?? '—'}</span>
          </div>
        </Row>
        <div className="checks">
          <label className="check">
            <input type="checkbox" checked={opts.threshold === null} onChange={(e) => dispatch({ type: 'setOptions', options: { threshold: e.target.checked ? null : det?.otsu ?? 128 } })} />
            Automatic (Otsu)
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.invert} onChange={(e) => dispatch({ type: 'setOptions', options: { invert: e.target.checked } })} />
            Light part on dark background
          </label>
        </div>
        <Row label="Smoothing" hint="Douglas–Peucker tolerance. Higher values give fewer, straighter edges.">
          <div className="inline">
            <input type="range" min={0.5} max={8} step={0.25} value={opts.epsilon} onChange={(e) => dispatch({ type: 'setOptions', options: { epsilon: Number(e.target.value) } })} aria-label="Smoothing tolerance" disabled={!src} />
            <span className="num val">{opts.epsilon.toFixed(2)} px</span>
          </div>
        </Row>
        <Row label="Ignore holes under">
          <NumberField value={opts.minHoleArea} onCommit={(v) => dispatch({ type: 'setOptions', options: { minHoleArea: Math.round(v) } })} suffix="px²" min={1} max={100000} label="Minimum hole area" decimals={0} />
        </Row>
        {edits > 0 && <p className="note">Changing detection re-traces the part. Your {edits} edit{edits > 1 ? 's stay' : ' stays'} in undo history.</p>}
        {det && det.coverage > 0.6 && (
          <p className="note note-warn">The part covers {Math.round(det.coverage * 100)}% of the frame. If the background was picked up as the part, toggle “Light part on dark background”.</p>
        )}
      </Section>
    </>
  );
}

function Histogram({ hist, threshold, otsu, invert }: { hist?: number[]; threshold: number; otsu?: number; invert: boolean }) {
  const W = 216, H = 56;
  const path = useMemo(() => {
    if (!hist) return '';
    // Log scale keeps the smaller (part) mode visible next to a large background mode.
    const v = hist.map((c) => Math.log1p(c));
    const max = Math.max(...v) || 1;
    return v.map((c, i) => `${i ? 'L' : 'M'}${((i / 255) * W).toFixed(1)} ${(H - (c / max) * (H - 4)).toFixed(1)}`).join('') + `L${W} ${H}L0 ${H}Z`;
  }, [hist]);
  const tx = (threshold / 255) * W;
  return (
    <figure className="hist" aria-label="Brightness histogram with threshold">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" height={H}>
        <rect x={invert ? tx : 0} width={invert ? W - tx : tx} height={H} fill="var(--accent-soft)" />
        {path && <path d={path} fill="var(--border-strong)" />}
        {otsu !== undefined && <line x1={(otsu / 255) * W} x2={(otsu / 255) * W} y1={0} y2={H} stroke="var(--text-3)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />}
        <line x1={tx} x2={tx} y1={0} y2={H} stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        <span>Dark</span>
        <span className="hist-key">Tinted range = part</span>
        <span>Light</span>
      </figcaption>
    </figure>
  );
}

export function ScanRight() {
  const { state, dispatch } = useStore();
  const src = state.source;
  const cal = state.calibration;
  const units = unitOf(state);
  const [refText, setRefText] = useState('100');
  const [nameText, setNameText] = useState('');
  const pxLen = state.calPoints.length === 2 ? dist(state.calPoints[0], state.calPoints[1]) : 0;
  const refMm = parseLength(refText, state.units);
  const det = state.detect.result;
  // The result reflects what was detected, not later edits.
  const part = state.original;

  const apply = () => {
    if (!src || !pxLen || !refMm || refMm <= 0) return;
    const sourcePx = pxLen / src.procScale;
    const c: Calibration = {
      pxPerMm: sourcePx / refMm,
      sourceWidth: src.width,
      sourceHeight: src.height,
      method: 'two-point',
      name: nameText.trim() || `${fmtLen(refMm, state.units)} ${state.units} reference`,
      refMm,
      createdAt: Date.now(),
    };
    dispatch({ type: 'setCalibration', calibration: c, persist: true });
    dispatch({ type: 'setTool', tool: 'select' });
    dispatch({ type: 'toast', text: `Calibrated: ${c.pxPerMm.toFixed(3)} px/mm`, tone: 'ok' });
  };

  const useSampleBar = () => {
    if (!src) return;
    dispatch({ type: 'setTool', tool: 'calibrate' });
    dispatch({ type: 'setCalPoints', points: [SAMPLE_REFERENCE.a, SAMPLE_REFERENCE.b].map((p) => ({ x: p.x * src.procScale, y: p.y * src.procScale })) });
    setRefText(String(SAMPLE_REFERENCE.mm));
  };

  return (
    <>
      <Section title="Calibration">
        {cal ? (
          <div className="cal-state">
            <span className="tag tag-ok"><span className="dot" />Calibrated</span>
            <Readout label="Scale" value={cal.pxPerMm.toFixed(3)} unit="px/mm" />
            <Readout label="Profile" value={<span className="plain">{cal.name}</span>} />
          </div>
        ) : (
          <div className="cal-state">
            <span className="tag tag-warn"><span className="dot" />Not calibrated</span>
            <p className="note">Dimensions show in pixels until you set a scale. Place a ruler or a part of known size in the photo.</p>
          </div>
        )}
        <ol className="steps">
          <li data-done={state.tool === 'calibrate' || state.calPoints.length > 0}>
            <span>
              Choose <button className="linklike" onClick={() => dispatch({ type: 'setTool', tool: 'calibrate' })} disabled={!src}><Crosshair size={12} /> Calibrate</button> <span className="kbd">C</span>
            </span>
          </li>
          <li data-done={state.calPoints.length === 2}><span>Click both ends of a known distance on the image</span></li>
          <li><span>Enter the real distance and apply</span></li>
        </ol>
        <Readout label="Picked distance" value={pxLen ? (pxLen / (src?.procScale ?? 1)).toFixed(1) : '—'} unit={pxLen ? 'px' : undefined} />
        <Row label="Real distance">
          <label className="field" data-invalid={refText !== '' && (refMm === null || refMm <= 0)}>
            <input className="num" value={refText} onChange={(e) => setRefText(e.target.value)} aria-label="Real distance" onKeyDown={(e) => e.key === 'Enter' && apply()} />
            <span className="field-suffix">{state.units}</span>
          </label>
        </Row>
        <Row label="Profile name">
          <label className="field">
            <input value={nameText} onChange={(e) => setNameText(e.target.value)} placeholder="e.g. Bench camera, 600 mm" aria-label="Profile name" />
          </label>
        </Row>
        <button className="btn btn-block" disabled={!pxLen || !refMm || refMm <= 0} onClick={apply}>
          Apply calibration
        </button>
        {state.past.length > 0 && <p className="note">Applying a new scale re-measures the scan and clears undo history.</p>}
        {src?.kind === 'sample' && (
          <button className="btn btn-block" onClick={useSampleBar}>
            Pick the sample’s 100 mm bar
          </button>
        )}
        {state.profiles.length > 0 && (
          <div className="profiles">
            <div className="sub-h">Saved profiles</div>
            {state.profiles.map((p) => (
              <div key={p.createdAt} className="profile" data-active={cal?.createdAt === p.createdAt}>
                <button className="profile-main" onClick={() => dispatch({ type: 'setCalibration', calibration: p, persist: true })} title="Use this calibration">
                  <span className="profile-name">{p.name}</span>
                  <span className="num profile-sub">{p.pxPerMm.toFixed(3)} px/mm · {p.sourceWidth}×{p.sourceHeight}</span>
                </button>
                <button className="btn btn-ghost icon-btn" aria-label={`Delete ${p.name}`} onClick={() => dispatch({ type: 'deleteProfile', createdAt: p.createdAt })}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Result">
        {state.detect.status === 'error' && <p className="note note-err">{state.detect.error}</p>}
        {!src && <Empty>Load an image to see what the detector finds.</Empty>}
        {det && part && (
          <>
            <Readout label="Width" value={fmtLen(bbox(part.outline).maxX - bbox(part.outline).minX, units)} unit={units} />
            <Readout label="Height" value={fmtLen(bbox(part.outline).maxY - bbox(part.outline).minY, units)} unit={units} />
            <Readout label="Area" value={units === 'in' ? (area(part.outline) / 645.16).toFixed(3) : area(part.outline).toFixed(units === 'px' ? 0 : 1)} unit={units === 'px' ? 'px²' : `${units}²`} />
            <Readout label="Perimeter" value={fmtLen(perimeter(part.outline), units)} unit={units} />
            <Readout label="Outline" value={part.outline.length} unit="vertices" />
            <Readout label="Threshold" value={det.threshold} unit={state.options.threshold === null ? 'Otsu' : 'manual'} />
            <div className="sub-h">Holes ({part.holes.length})</div>
            {part.holes.length === 0 && <Empty>No enclosed holes found.</Empty>}
            <table className="tbl">
              <tbody>
                {part.holes.map((h, i) => {
                  const round = det.holes[i]?.fitted;
                  return (
                    <tr key={h.id}>
                      <td className="tbl-id">H{i + 1}</td>
                      <td className="num">Ø{fmtLen(h.d, units)}</td>
                      <td className="num muted">{fmtLen(h.x, units)}, {fmtLen(h.y, units)}</td>
                      <td>{!round && <span className="tag tag-warn" title="The boundary does not fit a circle well; diameter comes from area">area</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className="btn btn-primary btn-block" onClick={() => dispatch({ type: 'setStage', stage: 'edit' })}>
              Continue to edit <ArrowRight size={14} />
            </button>
          </>
        )}
      </Section>
    </>
  );
}
