import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Detection, DetectOptions, Stage as CvStage } from '../cv/pipeline';
import type { Part, Vec } from '../geom/polygon';
import { DEFAULT_MACHINING, type MachiningSettings } from '../export/gcode';
import { load, save } from '../lib/storage';
import type { LengthUnit, Unit } from '../lib/units';
import { detectionToPart, type Frame } from './convert';

export type Calibration = {
  /** Pixels per millimetre measured in source-image pixels. */
  pxPerMm: number;
  sourceWidth: number;
  sourceHeight: number;
  method: 'two-point' | 'sample';
  name: string;
  refMm: number;
  createdAt: number;
};

export type Source = {
  kind: 'upload' | 'camera' | 'sample';
  name: string;
  /** Object or data URL of the full-resolution image, for display. */
  url: string;
  width: number;
  height: number;
  /** Downscaled pixels the detector runs on. */
  proc: ImageData;
  /** proc.width / width */
  procScale: number;
};

export type Selection = null | { kind: 'part' } | { kind: 'edge'; index: number } | { kind: 'vertex'; index: number } | { kind: 'hole'; id: string };
export type Tool = 'select' | 'pan' | 'measure' | 'hole' | 'calibrate';
export type WorkStage = 'scan' | 'edit' | 'export';

type HistoryEntry = { part: Part; label: string };

export type State = {
  stage: WorkStage;
  tool: Tool;
  view: 'plan' | '3d';
  compare: boolean;
  imageOpacity: number;
  units: Unit;
  partName: string;
  source: Source | null;
  options: DetectOptions;
  detect: { status: 'idle' | 'running' | 'done' | 'error'; stage?: CvStage; error?: string; ms?: number; result?: Detection };
  calibration: Calibration | null;
  /** Saved two-point calibrations (camera setups). */
  profiles: Calibration[];
  calPoints: Vec[]; // processing-image px
  measurePoints: Vec[]; // world units
  frame: Frame | null;
  original: Part | null;
  part: Part | null;
  /** Uncommitted geometry while dragging; rendered instead of `part`. */
  draft: Part | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selection: Selection;
  machining: MachiningSettings;
  toast: { id: number; text: string; tone: 'ok' | 'err' | 'info' } | null;
};

export type Action =
  | { type: 'setSource'; source: Source }
  | { type: 'clearSource' }
  | { type: 'setOptions'; options: Partial<DetectOptions> }
  | { type: 'detectStart' }
  | { type: 'detectStage'; stage: CvStage }
  | { type: 'detectDone'; result: Detection; ms: number }
  | { type: 'detectError'; error: string }
  | { type: 'setCalibration'; calibration: Calibration | null; persist?: boolean }
  | { type: 'deleteProfile'; createdAt: number }
  | { type: 'setCalPoints'; points: Vec[] }
  | { type: 'setMeasurePoints'; points: Vec[] }
  | { type: 'commit'; part: Part; label: string; selection?: Selection }
  | { type: 'draft'; part: Part | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'resetToScan' }
  | { type: 'select'; selection: Selection }
  | { type: 'setTool'; tool: Tool }
  | { type: 'setStage'; stage: WorkStage }
  | { type: 'setView'; view: 'plan' | '3d' }
  | { type: 'toggleCompare' }
  | { type: 'setImageOpacity'; value: number }
  | { type: 'setUnits'; units: Unit }
  | { type: 'setPartName'; name: string }
  | { type: 'setMachining'; patch: Partial<MachiningSettings> }
  | { type: 'toast'; text: string; tone?: 'ok' | 'err' | 'info' }
  | { type: 'dismissToast' };

const KEYS = { cal: 'irontronics.calibration.v1', machining: 'irontronics.machining.v1', prefs: 'irontronics.prefs.v1' };
const HISTORY_LIMIT = 200;

type Stored = { active: Calibration | null; profiles: Calibration[] };

export function initialState(): State {
  const cal = load<Stored>(KEYS.cal, { active: null, profiles: [] });
  const prefs = load<{ units: Unit }>(KEYS.prefs, { units: 'mm' });
  return {
    stage: 'scan',
    tool: 'select',
    view: 'plan',
    compare: false,
    imageOpacity: 0,
    units: prefs.units === 'in' ? 'in' : 'mm',
    partName: 'Untitled part',
    source: null,
    options: { threshold: null, invert: false, epsilon: 1.5, minHoleArea: 12 },
    detect: { status: 'idle' },
    calibration: cal.active,
    profiles: cal.profiles ?? [],
    calPoints: [],
    measurePoints: [],
    frame: null,
    original: null,
    part: null,
    draft: null,
    past: [],
    future: [],
    selection: null,
    machining: { ...DEFAULT_MACHINING, ...load<Partial<MachiningSettings>>(KEYS.machining, {}) },
    toast: null,
  };
}

/** World units per processing pixel for the current calibration (source px when uncalibrated). */
export function worldPerProcPx(source: Source, cal: Calibration | null): number {
  return cal ? 1 / (cal.pxPerMm * source.procScale) : 1 / source.procScale;
}

function derive(state: State, result: Detection, keepHistory: boolean): State {
  if (!state.source) return state;
  const { part, frame } = detectionToPart(result, worldPerProcPx(state.source, state.calibration));
  const past = keepHistory && state.part ? [...state.past, { part: state.part, label: 'Re-detect' }].slice(-HISTORY_LIMIT) : [];
  return { ...state, frame, original: part, part, draft: null, past, future: [], selection: null, measurePoints: [] };
}

let toastSeq = 0;

export function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'setSource':
      return {
        ...state,
        source: a.source,
        // The sample's preset scale never carries over to a real photo; fall back to the saved profile.
        calibration: a.source.kind !== 'sample' && state.calibration?.method === 'sample' ? load<Stored>(KEYS.cal, { active: null, profiles: [] }).active : state.calibration,
        stage: 'scan',
        tool: 'select',
        view: 'plan',
        partName: a.source.name.replace(/\.[a-z0-9]+$/i, '') || 'Untitled part',
        detect: { status: 'idle' },
        frame: null,
        original: null,
        part: null,
        draft: null,
        past: [],
        future: [],
        selection: null,
        calPoints: [],
        measurePoints: [],
      };
    case 'clearSource':
      return { ...initialState(), units: state.units, machining: state.machining, calibration: state.calibration, profiles: state.profiles };
    case 'setOptions':
      return { ...state, options: { ...state.options, ...a.options } };
    case 'detectStart':
      return { ...state, detect: { ...state.detect, status: 'running', stage: undefined, error: undefined } };
    case 'detectStage':
      return state.detect.status === 'running' ? { ...state, detect: { ...state.detect, stage: a.stage } } : state;
    case 'detectDone': {
      const next = { ...state, detect: { status: 'done' as const, ms: a.ms, result: a.result } };
      return derive(next, a.result, true);
    }
    case 'detectError':
      return { ...state, detect: { status: 'error', error: a.error }, frame: null, original: null, part: null, draft: null, selection: null };
    case 'setCalibration': {
      let profiles = state.profiles;
      if (a.persist && a.calibration) {
        profiles = [a.calibration, ...state.profiles.filter((p) => p.createdAt !== a.calibration!.createdAt)].slice(0, 8);
      }
      if (a.persist !== false && (a.calibration?.method !== 'sample')) {
        save(KEYS.cal, { active: a.calibration, profiles });
      }
      const next = { ...state, calibration: a.calibration, profiles, calPoints: [] };
      // Units changed meaning, so history from the old scale cannot be replayed.
      return next.detect.result ? derive(next, next.detect.result, false) : next;
    }
    case 'deleteProfile': {
      const profiles = state.profiles.filter((p) => p.createdAt !== a.createdAt);
      const active = state.calibration?.createdAt === a.createdAt ? null : state.calibration;
      save(KEYS.cal, { active: active?.method === 'sample' ? null : active, profiles });
      return { ...state, profiles };
    }
    case 'setCalPoints':
      return { ...state, calPoints: a.points };
    case 'setMeasurePoints':
      return { ...state, measurePoints: a.points };
    case 'commit':
      if (!state.part) return state;
      return {
        ...state,
        part: a.part,
        draft: null,
        past: [...state.past, { part: state.part, label: a.label }].slice(-HISTORY_LIMIT),
        future: [],
        selection: a.selection === undefined ? state.selection : a.selection,
      };
    case 'draft':
      return { ...state, draft: a.part };
    case 'undo': {
      const prev = state.past[state.past.length - 1];
      if (!prev || !state.part) return state;
      return {
        ...state,
        part: prev.part,
        draft: null,
        past: state.past.slice(0, -1),
        future: [{ part: state.part, label: prev.label }, ...state.future],
        selection: validSelection(state.selection, prev.part),
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next || !state.part) return state;
      return {
        ...state,
        part: next.part,
        draft: null,
        past: [...state.past, { part: state.part, label: next.label }],
        future: state.future.slice(1),
        selection: validSelection(state.selection, next.part),
      };
    }
    case 'resetToScan':
      if (!state.original || !state.part) return state;
      return { ...state, part: state.original, past: [...state.past, { part: state.part, label: 'Revert to scan' }], future: [], selection: null };
    case 'select':
      return { ...state, selection: a.selection };
    case 'setTool':
      return { ...state, tool: a.tool, calPoints: a.tool === 'calibrate' ? state.calPoints : [], measurePoints: a.tool === 'measure' ? state.measurePoints : [] };
    case 'setStage': {
      const tool = a.stage !== 'scan' && state.tool === 'calibrate' ? 'select' : a.stage !== 'edit' && state.tool === 'hole' ? 'select' : state.tool;
      // Scan works on the photo and Export shows the toolpath, both in plan.
      return { ...state, stage: a.stage, tool, view: a.stage === 'edit' ? state.view : 'plan', selection: a.stage === 'export' ? null : state.selection };
    }
    case 'setView':
      return { ...state, view: a.view };
    case 'toggleCompare':
      return { ...state, compare: !state.compare };
    case 'setImageOpacity':
      return { ...state, imageOpacity: a.value };
    case 'setUnits':
      save(KEYS.prefs, { units: a.units });
      return { ...state, units: a.units };
    case 'setPartName':
      return { ...state, partName: a.name };
    case 'setMachining': {
      const machining = { ...state.machining, ...a.patch };
      save(KEYS.machining, machining);
      return { ...state, machining };
    }
    case 'toast':
      return { ...state, toast: { id: ++toastSeq, text: a.text, tone: a.tone ?? 'info' } };
    case 'dismissToast':
      return { ...state, toast: null };
  }
}

function validSelection(sel: Selection, part: Part): Selection {
  if (!sel) return sel;
  if (sel.kind === 'hole') return part.holes.some((h) => h.id === sel.id) ? sel : null;
  if (sel.kind === 'edge' || sel.kind === 'vertex') return sel.index < part.outline.length ? sel : null;
  return sel;
}

/** Effective unit for display: pixels until calibrated. */
export const unitOf = (s: State): LengthUnit => (s.calibration ? s.units : 'px');
export const shownPart = (s: State) => s.draft ?? s.part;

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'dismissToast' }), 3200);
    return () => clearTimeout(t);
  }, [state.toast]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
