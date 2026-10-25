import { useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { useStore, shownPart, unitOf } from '../state/store';
import { Section, Row, Readout, NumberField, Seg, Empty } from './ui';
import { IssueList } from './EditPanels';
import { generateGcode } from '../export/gcode';
import { generateDxf, generateSvg } from '../export/vector';
import { validatePart } from '../geom/validate';
import { download, safeFileName } from '../lib/image';
import { fmtLen } from '../lib/units';

type Format = 'gcode' | 'dxf' | 'svg' | 'json';
const FORMATS: { value: Format; label: string; ext: string; mime: string }[] = [
  { value: 'gcode', label: 'G-code', ext: 'nc', mime: 'text/plain' },
  { value: 'dxf', label: 'DXF', ext: 'dxf', mime: 'application/dxf' },
  { value: 'svg', label: 'SVG', ext: 'svg', mime: 'image/svg+xml' },
  { value: 'json', label: 'JSON', ext: 'json', mime: 'application/json' },
];

export function useExportState() {
  const { state, dispatch } = useStore();
  const [format, setFormat] = useState<Format>('gcode');
  const part = shownPart(state);
  const issues = useMemo(() => (part ? validatePart(part, state.machining, !!state.calibration) : []), [part, state.machining, state.calibration]);
  const errors = issues.filter((i) => i.level === 'error');
  const f = FORMATS.find((x) => x.value === format)!;

  const output = useMemo(() => {
    if (!part || errors.length) return null;
    if (format === 'gcode') return generateGcode(part, state.machining, state.partName);
    if (format === 'dxf') return { code: generateDxf(part) };
    if (format === 'svg') return { code: generateSvg(part) };
    return {
      code: JSON.stringify(
        {
          name: state.partName,
          units: 'mm',
          calibration: state.calibration && { pxPerMm: state.calibration.pxPerMm, method: state.calibration.method, profile: state.calibration.name },
          outline: part.outline.map((p) => [round(p.x), round(p.y)]),
          holes: part.holes.map((h, i) => ({ id: `H${i + 1}`, x: round(h.x), y: round(h.y), d: round(h.d) })),
          machining: state.machining,
        },
        null,
        2,
      ),
    };
  }, [part, errors.length, format, state.machining, state.partName, state.calibration]);

  const fileName = `${safeFileName(state.partName)}.${f.ext}`;
  return {
    format,
    setFormat,
    formatLabel: f.label,
    issues,
    errors,
    output,
    fileName,
    canDownload: !!output,
    download: () => {
      if (!output) return;
      download(fileName, output.code, f.mime);
      dispatch({ type: 'toast', text: `Saved ${fileName}`, tone: 'ok' });
    },
  };
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;

export function ExportLeft() {
  const { state, dispatch } = useStore();
  const m = state.machining;
  const set = (patch: Partial<typeof m>) => dispatch({ type: 'setMachining', patch });
  const mill = m.mode === 'mill';
  return (
    <>
      <Section title="Machine">
        <Seg block value={m.mode} onChange={(mode) => set({ mode })} label="Machine type" options={[{ value: 'mill', label: 'CNC mill' }, { value: 'laser', label: 'Laser / plasma' }]} />
      </Section>
      <Section title="Tool">
        <Row label={mill ? 'Cutter diameter' : 'Kerf width'}>
          <NumberField value={m.toolDiameter} onCommit={(v) => set({ toolDiameter: v })} suffix="mm" min={0.01} max={50} step={0.1} label={mill ? 'Cutter diameter' : 'Kerf width'} decimals={3} />
        </Row>
        <Row label="Outline cut" hint={m.offset === 'outside' ? 'Tool runs outside the line: the part keeps its size.' : m.offset === 'inside' ? 'Tool runs inside the line: for cutting an opening to size.' : 'Tool centre follows the line; the part loses half the tool width.'}>
          <Seg block value={m.offset} onChange={(offset) => set({ offset })} label="Offset" options={[{ value: 'outside', label: 'Outside' }, { value: 'on', label: 'On line' }, { value: 'inside', label: 'Inside' }]} />
        </Row>
      </Section>
      <Section title="Holes">
        {mill ? (
          <Row label="Strategy" hint={m.holeStrategy === 'bore' ? 'Helical G2 arcs, compensated to the finished diameter.' : m.holeStrategy === 'drill' ? 'Peck drill at the hole centre. Fit a drill of the hole size.' : 'Holes are left out of the program.'}>
            <Seg block value={m.holeStrategy} onChange={(holeStrategy) => set({ holeStrategy })} label="Hole strategy" options={[{ value: 'drill', label: 'Drill' }, { value: 'bore', label: 'Bore' }, { value: 'skip', label: 'Skip' }]} />
          </Row>
        ) : (
          <p className="note">Holes are cut as circles, compensated for kerf, before the outline.</p>
        )}
        {mill && m.holeStrategy === 'drill' && (
          <Row label="Peck depth">
            <NumberField value={m.peck} onCommit={(v) => set({ peck: v })} suffix="mm" min={0.05} step={0.1} label="Peck depth" />
          </Row>
        )}
      </Section>
      <Section title="Feeds and depth">
        <div className="grid2">
          <Row label="Feed">
            <NumberField value={m.feed} onCommit={(v) => set({ feed: v })} suffix="mm/min" min={1} step={50} label="Feed rate" decimals={0} />
          </Row>
          {mill && (
            <Row label="Plunge">
              <NumberField value={m.plunge} onCommit={(v) => set({ plunge: v })} suffix="mm/min" min={1} step={10} label="Plunge rate" decimals={0} />
            </Row>
          )}
          <Row label={mill ? 'Spindle' : 'Power (S)'}>
            <NumberField value={m.spindle} onCommit={(v) => set({ spindle: v })} suffix={mill ? 'rpm' : ''} min={0} step={mill ? 500 : 10} label={mill ? 'Spindle speed' : 'Laser power'} decimals={0} />
          </Row>
          {mill ? (
            <>
              <Row label="Stock / cut depth">
                <NumberField value={m.depth} onCommit={(v) => set({ depth: v })} suffix="mm" min={0.01} step={0.5} label="Cut depth" />
              </Row>
              <Row label="Step-down">
                <NumberField value={m.stepDown} onCommit={(v) => set({ stepDown: v })} suffix="mm" min={0.01} step={0.1} label="Step-down" />
              </Row>
              <Row label="Safe Z">
                <NumberField value={m.safeZ} onCommit={(v) => set({ safeZ: v })} suffix="mm" min={0} step={1} label="Safe Z" />
              </Row>
            </>
          ) : (
            <>
              <Row label="Pierce delay">
                <NumberField value={m.pierceDelay} onCommit={(v) => set({ pierceDelay: v })} suffix="s" min={0} step={0.1} label="Pierce delay" />
              </Row>
              <Row label="Stock thickness">
                <NumberField value={m.depth} onCommit={(v) => set({ depth: v })} suffix="mm" min={0.01} step={0.5} label="Stock thickness" />
              </Row>
            </>
          )}
        </div>
        {mill && <p className="note">{Math.max(1, Math.ceil(m.depth / m.stepDown - 1e-9))} passes to {m.depth} mm.</p>}
      </Section>
    </>
  );
}

export function ExportRight({ exp }: { exp: ReturnType<typeof useExportState> }) {
  const { state } = useStore();
  const [copied, setCopied] = useState(false);
  const units = unitOf(state);
  const out = exp.output;
  const preview = out?.code ?? '';
  const lines = preview.split('\n');
  const shown = lines.slice(0, 400);

  const copy = async () => {
    if (!out) return;
    try {
      await navigator.clipboard.writeText(out.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; download still works */
    }
  };

  return (
    <>
      <Section title="Checks">
        <IssueList issues={exp.issues} />
      </Section>
      <Section title="File">
        <Seg block value={exp.format} onChange={exp.setFormat} label="Format" options={FORMATS.map((f) => ({ value: f.value, label: f.label }))} />
        <p className="note">
          {exp.format === 'gcode' && 'RS-274 for GRBL-style controllers: G21, G90, G94, G0/G1/G2, M3/M5, M30. Holes first, then the outline.'}
          {exp.format === 'dxf' && 'AutoCAD R12 ASCII. Outline as LINE entities on OUTLINE, holes as CIRCLE on HOLES. 1 unit = 1 mm.'}
          {exp.format === 'svg' && 'Profile at 1:1, sized in millimetres. Holes as circles.'}
          {exp.format === 'json' && 'Outline vertices, holes, calibration, and machining settings, in millimetres.'}
        </p>
        {out && 'cutLength' in out && (
          <div className="stats">
            <Readout label="Cut length" value={fmtLen(out.cutLength, units === 'px' ? 'mm' : units)} unit={units === 'px' ? 'mm' : units} />
            <Readout label="Feed time (est.)" value={out.estMinutes < 1 ? `${Math.round(out.estMinutes * 60)} s` : `${out.estMinutes.toFixed(1)} min`} />
          </div>
        )}
        {!out && <Empty>Resolve the errors above to generate the file.</Empty>}
        {out && (
          <>
            <div className="code" tabIndex={0} aria-label={`${exp.formatLabel} preview`}>
              <div className="code-h">
                <span>{exp.fileName}</span>
                <span className="num">{lines.length} lines</span>
              </div>
              <pre>
                {shown.map((l, i) => (
                  <div key={i} className="code-line">
                    <span className="code-n">{i + 1}</span>
                    <span>{l}</span>
                  </div>
                ))}
                {lines.length > shown.length && <div className="code-more">… {lines.length - shown.length} more lines in the file</div>}
              </pre>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={exp.download} title={`Save ${exp.fileName}`}>
                <Download size={14} /> Download
              </button>
            </div>
            {exp.format === 'gcode' && <p className="note">Check the toolpath on the canvas and dry-run above the stock before cutting. Irontronics does not simulate the program.</p>}
          </>
        )}
      </Section>
    </>
  );
}
