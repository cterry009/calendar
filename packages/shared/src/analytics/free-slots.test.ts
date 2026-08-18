import { findFreeSlots } from './free-slots.js';

describe('findFreeSlots', () => {
  it('returns the whole work range when nothing is occupied', () => {
    const slots = findFreeSlots({
      workRanges: [{ startMinute: 9 * 60, endMinute: 17 * 60 }],
      occupiedRanges: [],
      requiredMinutes: 30,
    });

    expect(slots).toEqual([{ startMinute: 9 * 60, endMinute: 17 * 60, durationMinutes: 8 * 60 }]);
  });

  it('subtracts an occupied range from the middle of a work block', () => {
    const slots = findFreeSlots({
      workRanges: [{ startMinute: 9 * 60, endMinute: 12 * 60 }],
      occupiedRanges: [{ startMinute: 10 * 60, endMinute: 10 * 60 + 30 }],
      requiredMinutes: 15,
    });

    expect(slots).toEqual([
      { startMinute: 9 * 60, endMinute: 10 * 60, durationMinutes: 60 },
      { startMinute: 10 * 60 + 30, endMinute: 12 * 60, durationMinutes: 90 },
    ]);
  });

  it('drops gaps shorter than the required duration', () => {
    const slots = findFreeSlots({
      workRanges: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
      occupiedRanges: [{ startMinute: 9 * 60 + 20, endMinute: 9 * 60 + 40 }],
      requiredMinutes: 30,
    });

    // Both remaining gaps (20min and 20min) are shorter than the 30min requirement.
    expect(slots).toEqual([]);
  });

  it('clips gaps to earliestMinute so today does not suggest the past', () => {
    const slots = findFreeSlots({
      workRanges: [{ startMinute: 9 * 60, endMinute: 17 * 60 }],
      occupiedRanges: [],
      requiredMinutes: 30,
      earliestMinute: 15 * 60,
    });

    expect(slots).toEqual([{ startMinute: 15 * 60, endMinute: 17 * 60, durationMinutes: 120 }]);
  });

  it('merges overlapping occupied ranges before subtracting', () => {
    const slots = findFreeSlots({
      workRanges: [{ startMinute: 9 * 60, endMinute: 12 * 60 }],
      occupiedRanges: [
        { startMinute: 9 * 60, endMinute: 10 * 60 },
        { startMinute: 9 * 60 + 30, endMinute: 11 * 60 },
      ],
      requiredMinutes: 15,
    });

    expect(slots).toEqual([{ startMinute: 11 * 60, endMinute: 12 * 60, durationMinutes: 60 }]);
  });

  it('spans multiple work blocks and honors maxResults', () => {
    const slots = findFreeSlots({
      workRanges: [
        { startMinute: 9 * 60, endMinute: 10 * 60 },
        { startMinute: 14 * 60, endMinute: 16 * 60 },
      ],
      occupiedRanges: [],
      requiredMinutes: 15,
      maxResults: 1,
    });

    expect(slots).toEqual([{ startMinute: 9 * 60, endMinute: 10 * 60, durationMinutes: 60 }]);
  });

  it('returns nothing when the work range is fully occupied', () => {
    const slots = findFreeSlots({
      workRanges: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
      occupiedRanges: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
      requiredMinutes: 15,
    });

    expect(slots).toEqual([]);
  });

  it('splits a work block around a fixed excluded window (e.g. lunch)', () => {
    const slots = findFreeSlots({
      workRanges: [{ startMinute: 9 * 60, endMinute: 18 * 60 }],
      occupiedRanges: [{ startMinute: 12 * 60 + 30, endMinute: 13 * 60 + 30 }],
      requiredMinutes: 25,
    });

    expect(slots).toEqual([
      { startMinute: 9 * 60, endMinute: 12 * 60 + 30, durationMinutes: 210 },
      { startMinute: 13 * 60 + 30, endMinute: 18 * 60, durationMinutes: 270 },
    ]);
  });
});
