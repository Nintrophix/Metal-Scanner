import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { fmtLen, parseLength, type LengthUnit } from '../lib/units';

export function Section({ title, children, actions, defaultOpen = true, flush }: { title: string; children: ReactNode; actions?: ReactNode; defaultOpen?: boolean; flush?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="sec">
      <header className="sec-h">
        <button className="sec-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          <ChevronDown size={12} strokeWidth={2.25} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform var(--t-fast)' }} />
          {title}
        </button>
        {actions && <div className="sec-actions">{actions}</div>}
      </header>
      {open && (
        <div id={id} className={flush ? 'sec-b sec-flush' : 'sec-b'}>
          {children}
        </div>
      )}
    </section>
  );
}

export function Row({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-l">{label}</div>
      <div className="row-c">{children}</div>
      {hint && <div className="row-hint">{hint}</div>}
    </div>
  );
}

export function Readout({ label, value, unit }: { label: ReactNode; value: ReactNode; unit?: string }) {
  return (
    <div className="readout">
      <span className="readout-l">{label}</span>
      <span className="readout-v num">
        {value}
        {unit && <span className="readout-u">{unit}</span>}
      </span>
    </div>
  );
}

/**
 * Length input in the current display unit. Commits on Enter or blur, reverts on Escape,
 * accepts arithmetic and unit suffixes, and flags invalid input instead of silently clamping.
 */
export function LengthField({ value, unit, onCommit, prefix, min = 0, label, disabled }: { value: number; unit: LengthUnit; onCommit: (mm: number) => void; prefix?: ReactNode; min?: number | null; label: string; disabled?: boolean }) {
  const shown = fmtLen(value, unit);
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // Sync from props during render (not in an effect) so a new selection never paints a stale value.
  const [synced, setSynced] = useState(shown);
  if (synced !== shown && !focused) {
    setSynced(shown);
    setText(shown);
    setInvalid(false);
  }
  const commit = () => {
    const v = parseLength(text, unit);
    if (v === null || (min !== null && v < min)) {
      setInvalid(true);
      return false;
    }
    setInvalid(false);
    if (Math.abs(v - value) > 1e-9) onCommit(v);
    return true;
  };
  return (
    <label className={`field${disabled ? ' field-disabled' : ''}`} data-invalid={invalid}>
      {prefix && <span className="field-prefix">{prefix}</span>}
      <input
        className="num"
        aria-label={label}
        aria-invalid={invalid}
        value={text}
        disabled={disabled}
        inputMode="decimal"
        spellCheck={false}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          if (!commit()) {
            setText(shown);
            setInvalid(false);
          }
        }}
        onChange={(e) => {
          setText(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Blur commits; committing here as well would record the edit twice.
            const v = parseLength(text, unit);
            if (v === null || (min !== null && v < min)) setInvalid(true);
            else (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setText(shown);
            setInvalid(false);
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const step = (e.shiftKey ? 10 : 1) * (unit === 'in' ? 0.0254 : unit === 'px' ? 1 : 0.1);
            const v = parseLength(text, unit) ?? value;
            const next = v + (e.key === 'ArrowUp' ? step : -step);
            if (min === null || next >= min) {
              onCommit(next);
              setText(fmtLen(next, unit));
            }
          }
        }}
      />
      <span className="field-suffix">{unit}</span>
    </label>
  );
}

/** Plain number input (feeds, speeds, percentages) with the same commit semantics. */
export function NumberField({ value, onCommit, suffix, min = 0, max, step = 1, label, decimals = 2 }: { value: number; onCommit: (v: number) => void; suffix?: string; min?: number; max?: number; step?: number; label: string; decimals?: number }) {
  const shown = String(Number(value.toFixed(decimals)));
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [synced, setSynced] = useState(shown);
  if (synced !== shown && !focused) {
    setSynced(shown);
    setText(shown);
  }
  const commit = () => {
    const v = Number(text.replace(',', '.'));
    if (!Number.isFinite(v) || v < min || (max !== undefined && v > max)) {
      setInvalid(true);
      return false;
    }
    setInvalid(false);
    if (v !== value) onCommit(v);
    return true;
  };
  return (
    <label className="field" data-invalid={invalid}>
      <input
        className="num"
        aria-label={label}
        aria-invalid={invalid}
        value={text}
        inputMode="decimal"
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          if (!commit()) {
            setText(shown);
            setInvalid(false);
          }
        }}
        onChange={(e) => {
          setText(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setText(shown);
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(max ?? Infinity, Math.max(min, value + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1)));
            onCommit(Number(next.toFixed(decimals)));
          }
        }}
      />
      {suffix && <span className="field-suffix">{suffix}</span>}
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange, label, block }: { value: T; options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[]; onChange: (v: T) => void; label: string; block?: boolean }) {
  return (
    <div className={block ? 'seg seg-block' : 'seg'} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} title={o.title} disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
