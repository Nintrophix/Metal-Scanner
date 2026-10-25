import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Box, Camera, ChevronDown, CircleDot, Crosshair, Download, GitCompare, Hand, HelpCircle, Image as ImageIcon, ImageUp, Maximize, MousePointer2, Redo2, Ruler, Scan, Square, Undo2, X } from 'lucide-react';
import { StoreProvider, useStore, shownPart, unitOf, type Tool, type WorkStage } from '../state/store';
import { runDetection, Superseded } from '../cv/client';
import { sourceFromFile, sourceFromSample, sourceFromVideo } from '../lib/image';
import { SAMPLE_PX_PER_MM, SAMPLE_REFERENCE } from '../lib/sample';
import { Viewport, type ViewportApi } from './plan/Viewport';
import { ScanLeft, ScanRight } from './ScanPanels';
import { EditLeft, EditRight } from './EditPanels';
import { ExportLeft, ExportRight, useExportState } from './ExportPanels';
import { Mark } from '../brand/Logo';
import { finishBoot } from '../App';
import { fmtLen } from '../lib/units';
import type { Vec } from '../geom/polygon';
import { deleteHole, deleteVertex, updateHole, moveVertex } from '../geom/edit';
import './workspace.css';

// three.js is only fetched when the 3D preview is first opened.
const View3D = lazy(() => import('./View3D').then((m) => ({ default: m.View3D })));

export default function Workspace({ sample }: { sample: boolean }) {
  return (
    <StoreProvider>
      <Shell sample={sample} />
    </StoreProvider>
  );
}

const STAGES: { id: WorkStage; label: string; key: string }[] = [
  { id: 'scan', label: 'Scan', key: '1' },
  { id: 'edit', label: 'Edit', key: '2' },
  { id: 'export', label: 'Export', key: '3' },
];

const TOOLS: { id: Tool; label: string; key: string; icon: typeof MousePointer2; stages: WorkStage[] }[] = [
  { id: 'select', label: 'Select and move', key: 'V', icon: MousePointer2, stages: ['scan', 'edit', 'export'] },
  { id: 'pan', label: 'Pan', key: 'H', icon: Hand, stages: ['scan', 'edit', 'export'] },
  { id: 'measure', label: 'Measure', key: 'M', icon: Ruler, stages: ['scan', 'edit', 'export'] },
  { id: 'hole', label: 'Add hole', key: 'O', icon: CircleDot, stages: ['edit'] },
  { id: 'calibrate', label: 'Calibrate', key: 'C', icon: Crosshair, stages: ['scan'] },
];

function Shell({ sample }: { sample: boolean }) {
  const { state, dispatch } = useStore();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cursor, setCursor] = useState<Vec | null>(null);
  const [zoomPct, setZoomPct] = useState(100);
  const [help, setHelp] = useState(false);
  const vp = useRef<ViewportApi | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const exp = useExportState();

  useEffect(() => finishBoot(), []);

  const loadSample = useCallback(() => {
    setCameraOpen(false);
    const s = sourceFromSample();
    dispatch({ type: 'setSource', source: s });
    // The sample's reference bar is exactly 100 mm at a known scale; apply it without persisting.
    dispatch({
      type: 'setCalibration',
      persist: false,
      calibration: { pxPerMm: SAMPLE_PX_PER_MM, sourceWidth: s.width, sourceHeight: s.height, method: 'sample', name: 'Sample reference bar (100 mm)', refMm: SAMPLE_REFERENCE.mm, createdAt: 0 },
    });
  }, [dispatch]);

  const sampleLoaded = useRef(false);
  useEffect(() => {
    if (sample && !sampleLoaded.current) {
      sampleLoaded.current = true;
      loadSample();
    }
  }, [sample, loadSample]);

  const openFile = useCallback(async (f: File | undefined) => {
    if (!f) return;
    try {
      setCameraOpen(false);
      dispatch({ type: 'setSource', source: await sourceFromFile(f) });
    } catch (e) {
      dispatch({ type: 'toast', text: (e as Error).message, tone: 'err' });
    }
  }, [dispatch]);

  // Detection: rerun whenever the source or the detection options change (debounced for sliders).
  const { source, options } = state;
  useEffect(() => {
    if (!source) return;
    let live = true;
    const t = setTimeout(() => {
      dispatch({ type: 'detectStart' });
      runDetection(source.proc, options, (stage) => live && dispatch({ type: 'detectStage', stage }))
        .then(({ result, ms }) => live && dispatch({ type: 'detectDone', result, ms }))
        .catch((e) => {
          if (!(e instanceof Superseded) && live) dispatch({ type: 'detectError', error: (e as Error).message });
        });
    }, 140);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [source, options, dispatch]);

  const canEdit = state.detect.status === 'done' && !!state.part;
  const stageEnabled = (s: WorkStage) => s === 'scan' || canEdit;

  // Keyboard shortcuts. Ignored while typing in a field.
  const part = shownPart(state);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
        return;
      }
      if (mod) return;
      const k = e.key.toLowerCase();
      const tool = TOOLS.find((x) => x.key.toLowerCase() === k);
      if (tool && tool.stages.includes(state.stage) && state.source) {
        dispatch({ type: 'setTool', tool: tool.id });
        return;
      }
      const st = STAGES.find((s) => s.key === e.key);
      if (st && stageEnabled(st.id)) return dispatch({ type: 'setStage', stage: st.id });
      if (k === 'f') return vp.current?.fit();
      if (k === '?') return setHelp((h) => !h);
      if (k === 'escape') {
        setHelp(false);
        if (state.tool !== 'select') dispatch({ type: 'setTool', tool: 'select' });
        else dispatch({ type: 'select', selection: null });
        return;
      }
      if (!part || state.stage !== 'edit') return;
      const sel = state.selection;
      if ((k === 'delete' || k === 'backspace') && sel) {
        e.preventDefault();
        if (sel.kind === 'hole') dispatch({ type: 'commit', part: deleteHole(part, sel.id), label: 'Delete hole', selection: null });
        if (sel.kind === 'vertex') {
          if (part.outline.length <= 3) dispatch({ type: 'toast', text: 'An outline needs at least three vertices.', tone: 'err' });
          else dispatch({ type: 'commit', part: deleteVertex(part, sel.index), label: `Delete vertex V${sel.index + 1}`, selection: null });
        }
        return;
      }
      if (k.startsWith('arrow') && sel && (sel.kind === 'hole' || sel.kind === 'vertex')) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.1;
        const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
        const dy = k === 'arrowdown' ? -step : k === 'arrowup' ? step : 0;
        if (sel.kind === 'hole') {
          const h = part.holes.find((x) => x.id === sel.id);
          if (h) dispatch({ type: 'commit', part: updateHole(part, h.id, { x: h.x + dx, y: h.y + dy }), label: 'Nudge hole' });
        } else {
          const p = part.outline[sel.index];
          dispatch({ type: 'commit', part: moveVertex(part, sel.index, { x: p.x + dx, y: p.y + dy }), label: `Nudge vertex V${sel.index + 1}` });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const units = unitOf(state);
  const primary = (() => {
    if (state.stage === 'scan') return { label: 'Continue to edit', icon: ArrowRight, disabled: !canEdit, run: () => dispatch({ type: 'setStage', stage: 'edit' }) };
    if (state.stage === 'edit') return { label: 'Export', icon: ArrowRight, disabled: !canEdit, run: () => dispatch({ type: 'setStage', stage: 'export' }) };
    return { label: `Download ${exp.formatLabel}`, icon: Download, disabled: !exp.canDownload, run: exp.download };
  })();

  const lastUndo = state.past[state.past.length - 1];
  const nextRedo = state.future[0];

  return (
    <div className="ws">
      <header className="topbar">
        <div className="topbar-l">
          <a href="#/" className="icon-btn btn btn-ghost" aria-label="Back to Irontronics home" title="Home">
            <Mark size={20} />
          </a>
          <nav className="crumbs" aria-label="Breadcrumb">
            <span className="crumb-root">Irontronics</span>
            <span className="crumb-sep">/</span>
            <input className="crumb-name" value={state.partName} aria-label="Part name" onChange={(e) => dispatch({ type: 'setPartName', name: e.target.value })} spellCheck={false} />
          </nav>
        </div>
        <nav className="stages" aria-label="Workflow">
          {STAGES.map((s) => (
            <button key={s.id} className="stage" aria-current={state.stage === s.id ? 'step' : undefined} disabled={!stageEnabled(s.id)} onClick={() => dispatch({ type: 'setStage', stage: s.id })} title={`${s.label} (${s.key})`}>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="topbar-r">
          <div className="btn-pair">
            <button className="btn btn-ghost icon-btn" disabled={!lastUndo} onClick={() => dispatch({ type: 'undo' })} aria-label="Undo" title={lastUndo ? `Undo ${lastUndo.label} (Ctrl+Z)` : 'Nothing to undo'}>
              <Undo2 size={15} />
            </button>
            <button className="btn btn-ghost icon-btn" disabled={!nextRedo} onClick={() => dispatch({ type: 'redo' })} aria-label="Redo" title={nextRedo ? `Redo ${nextRedo.label} (Ctrl+Shift+Z)` : 'Nothing to redo'}>
              <Redo2 size={15} />
            </button>
          </div>
          <span className="vsep" />
          <div className="seg" role="group" aria-label="Units" title={state.calibration ? 'Display units' : 'Calibrate to show real units'}>
            {(['mm', 'in'] as const).map((u) => (
              <button key={u} aria-pressed={state.units === u} disabled={!state.calibration} onClick={() => dispatch({ type: 'setUnits', units: u })}>
                {u}
              </button>
            ))}
          </div>
          <ZoomMenu pct={zoomPct} api={vp} disabled={!state.source || state.view === '3d'} calibrated={!!state.calibration} />
          <button className="btn btn-primary" disabled={primary.disabled} onClick={primary.run}>
            {primary.label}
            <primary.icon size={14} />
          </button>
        </div>
      </header>

      <div className="ws-body">
        <nav className="rail" aria-label="Tools">
          {TOOLS.map((t) => {
            const enabled = !!state.source && t.stages.includes(state.stage) && (t.id !== 'hole' || state.view === 'plan');
            return (
              <button key={t.id} className="rail-btn" aria-pressed={state.tool === t.id} disabled={!enabled} onClick={() => dispatch({ type: 'setTool', tool: t.id })} title={`${t.label} (${t.key})`} aria-label={t.label}>
                <t.icon size={17} strokeWidth={1.75} />
              </button>
            );
          })}
          <span className="rail-sep" />
          <button className="rail-btn" onClick={() => fileInput.current?.click()} title="Open photo" aria-label="Open photo">
            <ImageUp size={17} strokeWidth={1.75} />
          </button>
          <button className="rail-btn" aria-pressed={cameraOpen} onClick={() => setCameraOpen(true)} title="Camera" aria-label="Camera">
            <Camera size={17} strokeWidth={1.75} />
          </button>
          <div className="rail-fill" />
          <button className="rail-btn" aria-pressed={help} onClick={() => setHelp((h) => !h)} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
            <HelpCircle size={17} strokeWidth={1.75} />
          </button>
        </nav>

        <aside className="panel panel-l" aria-label="Stage controls">
          {state.stage === 'scan' && <ScanLeft onCamera={() => setCameraOpen(true)} onUpload={() => fileInput.current?.click()} onSample={loadSample} cameraOpen={cameraOpen} />}
          {state.stage === 'edit' && <EditLeft />}
          {state.stage === 'export' && <ExportLeft />}
        </aside>

        <main className="canvas" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); openFile(e.dataTransfer.files[0]); }}>
          {cameraOpen ? (
            <CameraCapture
              onClose={() => setCameraOpen(false)}
              onCapture={(s) => {
                setCameraOpen(false);
                dispatch({ type: 'setSource', source: s });
              }}
            />
          ) : !state.source ? (
            <EmptyState onCamera={() => setCameraOpen(true)} onUpload={() => fileInput.current?.click()} onSample={loadSample} />
          ) : state.view === '3d' && part && state.stage !== 'scan' ? (
            <Suspense fallback={<div className="canvas-loading"><span className="spinner" /> Loading 3D preview…</div>}>
              <View3D part={part} original={state.original} thickness={state.machining.depth} compare={state.compare} />
            </Suspense>
          ) : (
            <Viewport onCursor={setCursor} apiRef={vp} onZoom={setZoomPct} />
          )}
          {state.source && !cameraOpen && <CanvasNotes />}
          {state.source && !cameraOpen && (
            <div className="canvas-tools" role="toolbar" aria-label="View">
              {state.stage !== 'scan' && canEdit && (
                <button className="btn" aria-pressed={state.compare} data-sel={state.compare} onClick={() => dispatch({ type: 'toggleCompare' })} title="Overlay the original scan as a dashed outline">
                  <GitCompare size={13} /> Compare
                </button>
              )}
              {state.stage !== 'scan' && canEdit && state.view === 'plan' && (
                <button className="btn" aria-pressed={state.imageOpacity > 0} data-sel={state.imageOpacity > 0} onClick={() => dispatch({ type: 'setImageOpacity', value: state.imageOpacity > 0 ? 0 : 0.4 })} title="Show the photo under the part">
                  <ImageIcon size={13} /> Photo
                </button>
              )}
              {state.view === 'plan' && (
                <button className="btn icon-btn" onClick={() => vp.current?.fit()} title="Zoom to fit (F)" aria-label="Zoom to fit">
                  <Maximize size={13} />
                </button>
              )}
              {state.stage !== 'scan' && canEdit && (
                <div className="seg" role="group" aria-label="View mode">
                  <button aria-pressed={state.view === 'plan'} onClick={() => dispatch({ type: 'setView', view: 'plan' })} title="Plan view">
                    <Square size={12} /> Plan
                  </button>
                  <button aria-pressed={state.view === '3d'} onClick={() => dispatch({ type: 'setView', view: '3d' })} title="Extruded 3D preview">
                    <Box size={12} /> 3D
                  </button>
                </div>
              )}
            </div>
          )}
          {help && <ShortcutSheet onClose={() => setHelp(false)} />}
        </main>

        <aside className="panel panel-r" aria-label="Inspector">
          {state.stage === 'scan' && <ScanRight />}
          {state.stage === 'edit' && <EditRight />}
          {state.stage === 'export' && <ExportRight exp={exp} />}
        </aside>
      </div>

      <footer className="status">
        <StatusDetect />
        <span className="status-item">
          {state.calibration ? (
            <>
              <span className="dot" style={{ color: 'var(--green)' }} />
              <span className="num">{state.calibration.pxPerMm.toFixed(3)}</span> px/mm<span className="status-cal-name"> · {state.calibration.name}</span>
            </>
          ) : (
            <>
              <span className="dot" style={{ color: 'var(--amber)' }} />
              Not calibrated, values in px
            </>
          )}
        </span>
        {state.calibration && state.source && state.calibration.method !== 'sample' && state.calibration.sourceWidth !== state.source.width && (
          <span className="status-item status-warn">Calibrated at {state.calibration.sourceWidth}×{state.calibration.sourceHeight}; this image is {state.source.width}×{state.source.height}</span>
        )}
        <span className="status-fill" />
        {cursor && state.view === 'plan' && (
          <span className="status-item num">
            X {fmtLen(cursor.x, units)} Y {fmtLen(cursor.y, units)} {units}
          </span>
        )}
        <span className="status-item">{state.past.length ? `${state.past.length} edit${state.past.length > 1 ? 's' : ''}` : 'No edits'}</span>
      </footer>

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ''; }} />
      {state.toast && (
        <div key={state.toast.id} className={`toast toast-${state.toast.tone}`} role="status">
          {state.toast.text}
          <button className="btn btn-ghost icon-btn" aria-label="Dismiss" onClick={() => dispatch({ type: 'dismissToast' })}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function StatusDetect() {
  const { state } = useStore();
  const d = state.detect;
  const labels: Record<string, string> = { grayscale: 'Grayscale', threshold: 'Thresholding', components: 'Finding the part', boundary: 'Tracing boundary', simplify: 'Simplifying', holes: 'Detecting holes' };
  let content;
  if (!state.source) content = <>No image</>;
  else if (d.status === 'running') content = <><span className="spinner" aria-hidden /> {d.stage ? labels[d.stage] : 'Queued'}…</>;
  else if (d.status === 'error') content = <><span className="dot" style={{ color: 'var(--red)' }} /> Detection failed</>;
  else if (d.status === 'done' && d.result) content = <><span className="dot" style={{ color: 'var(--green)' }} /> Traced in <span className="num">{Math.round(d.ms ?? 0)}</span> ms</>;
  else content = <>Waiting</>;
  return <span className="status-item" aria-live="polite">{content}</span>;
}

function CanvasNotes() {
  const { state } = useStore();
  const d = state.detect;
  if (state.stage === 'scan' && d.status === 'error') {
    return <div className="canvas-note canvas-note-err" role="alert">{d.error}</div>;
  }
  if (state.tool === 'calibrate') {
    const n = state.calPoints.length;
    return <div className="canvas-note">{n === 0 ? 'Click the first end of a known distance on the image.' : n === 1 ? 'Click the second end.' : 'Enter the real distance in the Calibration panel, or click again to restart.'}</div>;
  }
  if (state.tool === 'measure') return <div className="canvas-note">Click two points to measure. Vertices and hole centres snap.</div>;
  if (state.tool === 'hole') return <div className="canvas-note">Click inside the outline to place a hole.</div>;
  if (state.view === '3d') return <div className="canvas-note">Extruded preview at {state.machining.depth} mm stock thickness (set in Export). Thickness is not measured by the scan.</div>;
  return null;
}

function ZoomMenu({ pct, api, disabled, calibrated }: { pct: number; api: React.MutableRefObject<ViewportApi | null>; disabled: boolean; calibrated: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  const items: [string, () => void][] = [
    ['Zoom to fit  F', () => api.current?.fit()],
    ['Zoom in', () => api.current?.zoomBy(1.25)],
    ['Zoom out', () => api.current?.zoomBy(0.8)],
    ...[50, 100, 200, 400].map((p) => [`${p}%${calibrated && p === 100 ? '  actual size' : ''}`, () => api.current?.zoomTo(p)] as [string, () => void]),
  ];
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn zoom-btn" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title={calibrated ? '100% shows the part at real size on a 96 dpi display' : 'Zoom'}>
        <span className="num">{Math.round(pct)}%</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map(([label, run]) => (
            <button key={label} role="menuitem" onClick={() => { run(); setOpen(false); }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onCamera, onUpload, onSample }: { onCamera: () => void; onUpload: () => void; onSample: () => void }) {
  return (
    <div className="empty-state">
      <div className="es-inner">
        <h1>Start a scan</h1>
        <p>Photograph a flat metal part from directly above. Irontronics traces its outline and holes, measures them, and prepares a cut file.</p>
        <div className="es-actions">
          <button className="es-opt" onClick={onCamera}>
            <Camera size={18} strokeWidth={1.75} />
            <span>
              <b>Use camera</b>
              <small>Live preview, capture a frame</small>
            </span>
          </button>
          <button className="es-opt" onClick={onUpload}>
            <ImageUp size={18} strokeWidth={1.75} />
            <span>
              <b>Open a photo</b>
              <small>JPEG, PNG, or WebP. Or drop it here</small>
            </span>
          </button>
          <button className="es-opt" onClick={onSample}>
            <Scan size={18} strokeWidth={1.75} />
            <span>
              <b>Try the sample part</b>
              <small>Synthetic photo, pre-calibrated</small>
            </span>
          </button>
        </div>
        <ul className="es-reqs">
          <li>Camera directly overhead, lens parallel to the table</li>
          <li>Matte background that contrasts with the part</li>
          <li>Even light, no glare on the metal</li>
          <li>One part per photo, with a ruler or known distance in frame for calibration</li>
        </ul>
      </div>
    </div>
  );
}

function CameraCapture({ onClose, onCapture }: { onClose: () => void; onCapture: (s: Awaited<ReturnType<typeof sourceFromVideo>>) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setReady(false);
    setError(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs a secure page (https or localhost) and a browser that supports it. Open a photo instead.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        setDevices(list);
        if (!deviceId) setDeviceId(s.getVideoTracks()[0]?.getSettings().deviceId ?? '');
      })
      .catch((e: DOMException) => {
        const msg =
          e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access for this site in your browser settings, then try again.'
          : e.name === 'NotFoundError' || e.name === 'OverconstrainedError' ? 'No camera was found. Connect a camera, or open a photo instead.'
          : e.name === 'NotReadableError' ? 'The camera is in use by another application.'
          : `Could not start the camera (${e.message || e.name}).`;
        setError(msg);
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId]);

  const capture = async () => {
    if (!video.current) return;
    setBusy(true);
    try {
      onCapture(await sourceFromVideo(video.current));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const res = useMemo(() => (ready && video.current ? `${video.current.videoWidth}×${video.current.videoHeight}` : ''), [ready]);

  return (
    <div className="camera">
      <div className="camera-stage">
        {error ? (
          <div className="camera-err" role="alert">
            <Camera size={20} strokeWidth={1.5} />
            <p>{error}</p>
          </div>
        ) : (
          <>
            <video ref={video} playsInline muted onLoadedMetadata={() => setReady(true)} />
            {ready && <div className="camera-guide" aria-hidden />}
            {!ready && <div className="camera-wait"><span className="spinner" /> Starting camera…</div>}
          </>
        )}
      </div>
      <div className="camera-bar">
        <label className="field" style={{ width: 240 }}>
          <select className="select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} aria-label="Camera" disabled={!devices.length}>
            {!devices.length && <option value="">Camera</option>}
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        {res && <span className="tag num">{res}</span>}
        <span className="camera-hint">Keep the camera square to the table; the guide marks the frame centre.</span>
        <span className="status-fill" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={capture} disabled={!ready || !!error || busy}>
          <Camera size={14} /> Capture frame
        </button>
      </div>
    </div>
  );
}

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['V / H / M', 'Select, pan, measure'],
    ['O', 'Add hole (Edit)'],
    ['C', 'Calibrate (Scan)'],
    ['1 / 2 / 3', 'Scan, Edit, Export'],
    ['F', 'Zoom to fit'],
    ['Scroll', 'Zoom at cursor'],
    ['Space + drag', 'Pan'],
    ['Ctrl Z / Ctrl Shift Z', 'Undo / redo'],
    ['Arrows', 'Nudge 0.1 mm (Shift: 1 mm)'],
    ['Delete', 'Remove selected vertex or hole'],
    ['Double-click edge', 'Insert vertex'],
    ['Alt while dragging', 'Disable alignment snap'],
    ['Esc', 'Back to select, clear selection'],
  ];
  return (
    <div className="sheet" role="dialog" aria-label="Keyboard shortcuts">
      <div className="sheet-h">
        Keyboard shortcuts
        <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k.split(' / ').map((x, i) => <span key={i}>{i > 0 && ' / '}<span className="kbd">{x}</span></span>)}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
