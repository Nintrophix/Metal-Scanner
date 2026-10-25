// Display units. Geometry is always stored in millimetres; `px` marks uncalibrated values.
export type Unit = 'mm' | 'in';
export type LengthUnit = Unit | 'px';

const MM_PER_IN = 25.4;

export const toDisplay = (mm: number, u: LengthUnit) => (u === 'in' ? mm / MM_PER_IN : mm);
export const fromDisplay = (v: number, u: LengthUnit) => (u === 'in' ? v * MM_PER_IN : v);

export function decimals(u: LengthUnit) {
  return u === 'in' ? 4 : u === 'px' ? 1 : 2;
}

export function fmtLen(mm: number, u: LengthUnit, withUnit = false) {
  const s = toDisplay(mm, u).toFixed(decimals(u));
  return withUnit ? `${s} ${u}` : s;
}

/** Short pill label: trims trailing zeros (120.00 → 120, 6.60 → 6.6). */
export function fmtShort(mm: number, u: LengthUnit) {
  return toDisplay(mm, u).toFixed(decimals(u)).replace(/\.?0+$/, '');
}

/**
 * Parses a length typed by the user in the current display unit. Accepts plain numbers,
 * a trailing unit (`12.5mm`, `0.5in`, `0.5"`), and simple arithmetic (`120 + 2*5`, `100/4`).
 * Returns millimetres, or null when the text is not a valid expression.
 */
export function parseLength(text: string, u: LengthUnit): number | null {
  let s = text.trim().toLowerCase();
  if (!s) return null;
  let unit: LengthUnit = u;
  const m = s.match(/(mm|in|"|px)\s*$/);
  if (m) {
    unit = m[1] === '"' ? 'in' : (m[1] as LengthUnit);
    if (unit === 'px' && u !== 'px') return null;
    if (u === 'px' && unit !== 'px') return null;
    s = s.slice(0, m.index).trim();
  }
  const v = evalArithmetic(s);
  if (v === null || !Number.isFinite(v)) return null;
  return fromDisplay(v, unit);
}

/** Recursive-descent evaluator for + - * / and parentheses. No `eval`. */
export function evalArithmetic(src: string): number | null {
  const s = src.replace(/\s+/g, '').replace(/,/g, '.');
  let i = 0;
  const peek = () => s[i];
  function num(): number | null {
    const m = s.slice(i).match(/^\d*\.?\d+(e[+-]?\d+)?/);
    if (!m) return null;
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function factor(): number | null {
    if (peek() === '-') { i++; const v = factor(); return v === null ? null : -v; }
    if (peek() === '+') { i++; return factor(); }
    if (peek() === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') return null;
      i++;
      return v;
    }
    return num();
  }
  function term(): number | null {
    let v = factor();
    while (v !== null && (peek() === '*' || peek() === '/')) {
      const op = s[i++];
      const r = factor();
      if (r === null) return null;
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function expr(): number | null {
    let v = term();
    while (v !== null && (peek() === '+' || peek() === '-')) {
      const op = s[i++];
      const r = term();
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const v = expr();
  return i === s.length ? v : null;
}
