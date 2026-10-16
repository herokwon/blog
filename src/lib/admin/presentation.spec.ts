import { describe, expect, it } from 'vitest';
import { displayTime } from './presentation';

describe('Korean display time', () => {
  it.each([
    [null, '—'],
    ['2026-10-16T00:01:02.123Z', '2026-10-16 09:01:02'],
    ['2026-10-16T15:00:00.000Z', '2026-10-17 00:00:00'],
    ['2026-12-31T23:59:59.999Z', '2027-01-01 08:59:59'],
    ['2024-02-28T15:00:00.000Z', '2024-02-29 00:00:00'],
  ])('formats %s without changing its UTC source', (input, expected) => {
    expect(displayTime(input)).toBe(expected);
  });
});
