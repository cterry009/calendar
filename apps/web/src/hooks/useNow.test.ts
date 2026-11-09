import { describe, expect, it } from 'vitest';
import { dayKeyOf } from './useNow';

describe('dayKeyOf', () => {
  it('changes exactly at local midnight', () => {
    expect(dayKeyOf(new Date(2026, 10, 9, 23, 59, 59))).toBe('2026-11-9');
    expect(dayKeyOf(new Date(2026, 10, 10, 0, 0, 0))).toBe('2026-11-10');
    expect(dayKeyOf(new Date(2026, 10, 9, 0, 0))).toBe(dayKeyOf(new Date(2026, 10, 9, 18, 30)));
  });
});
