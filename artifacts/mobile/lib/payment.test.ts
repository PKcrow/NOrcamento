import { describe, expect, it } from 'vitest';
import { parsePaymentAmount, parsePaymentDate } from './payment';

describe('payment input parsing', () => {
  it.each([
    ['', null],
    ['0', null],
    ['-1', null],
    ['-0,01', null],
    ['valor inválido', null],
  ])('rejects invalid payment amount %j', (value, expected) => {
    expect(parsePaymentAmount(value)).toBe(expected);
  });

  it('accepts a positive amount with a decimal comma', () => {
    expect(parsePaymentAmount('350,50')).toBe(350.5);
  });

  it.each(['31/02/2026', '29/02/2025', '00/01/2026', '01/13/2026', '1/1/2026'])(
    'rejects invalid payment date %s',
    (value) => {
      expect(parsePaymentDate(value)).toBeNull();
    },
  );

  it('accepts a real date in DD/MM/AAAA format', () => {
    const date = parsePaymentDate('28/02/2026');
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(1);
    expect(date?.getDate()).toBe(28);
  });
});