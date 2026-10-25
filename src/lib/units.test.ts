import { describe, expect, it } from 'vitest';
import { evalArithmetic, fmtShort, parseLength } from './units';

describe('units', () => {
  it('parses plain numbers, unit suffixes, and arithmetic', () => {
    expect(parseLength('12.5', 'mm')).toBe(12.5);
    expect(parseLength('1in', 'mm')).toBeCloseTo(25.4);
    expect(parseLength('0.5"', 'mm')).toBeCloseTo(12.7);
    expect(parseLength('2', 'in')).toBeCloseTo(50.8);
    expect(parseLength('100 + 2*5', 'mm')).toBe(110);
    expect(parseLength('(10+2)/4', 'mm')).toBe(3);
  });
  it('rejects junk instead of guessing', () => {
    expect(parseLength('abc', 'mm')).toBeNull();
    expect(parseLength('5mm', 'px')).toBeNull();
    expect(evalArithmetic('2+')).toBeNull();
    expect(evalArithmetic('alert(1)')).toBeNull();
  });
  it('formats short labels', () => {
    expect(fmtShort(120, 'mm')).toBe('120');
    expect(fmtShort(6.6, 'mm')).toBe('6.6');
  });
});
