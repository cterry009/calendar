export interface MinuteRange {
  startMinute: number;
  endMinute: number;
}

export interface FreeSlot {
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
}

function sortRanges(ranges: MinuteRange[]): MinuteRange[] {
  return [...ranges].sort((a, b) => a.startMinute - b.startMinute);
}

/** Merges overlapping/touching ranges so subtraction doesn't double-count shared edges. */
function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = sortRanges(ranges);
  const merged: MinuteRange[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, range.endMinute);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

/** What's left of `range` after removing every overlapping piece of `occupied` (both pre-merged). */
function subtractRanges(range: MinuteRange, occupied: MinuteRange[]): MinuteRange[] {
  let remaining: MinuteRange[] = [range];

  for (const block of occupied) {
    const next: MinuteRange[] = [];
    for (const piece of remaining) {
      if (block.endMinute <= piece.startMinute || block.startMinute >= piece.endMinute) {
        next.push(piece); // no overlap
        continue;
      }
      if (block.startMinute > piece.startMinute) {
        next.push({ startMinute: piece.startMinute, endMinute: block.startMinute });
      }
      if (block.endMinute < piece.endMinute) {
        next.push({ startMinute: block.endMinute, endMinute: piece.endMinute });
      }
    }
    remaining = next;
  }

  return remaining;
}

/**
 * Contiguous gaps across `workRanges` that are free of `occupiedRanges` (already-scheduled tasks,
 * lunch/other excluded windows -- the caller decides what counts as "occupied") and at least
 * `requiredMinutes` long. Deliberately just a gap-finder over one day's minute ranges: no
 * pomodoro/break segmentation, no auto-scheduling -- assistive slot suggestions only.
 */
export function findFreeSlots(params: {
  workRanges: MinuteRange[];
  occupiedRanges: MinuteRange[];
  requiredMinutes: number;
  /** Clip out anything ending before this (e.g. "now", so today doesn't suggest the past). */
  earliestMinute?: number;
  maxResults?: number;
}): FreeSlot[] {
  const { workRanges, occupiedRanges, requiredMinutes, earliestMinute = 0, maxResults = 3 } = params;

  const mergedOccupied = mergeRanges(occupiedRanges);
  const mergedWork = mergeRanges(workRanges);

  const gaps = mergedWork
    .flatMap((range) => subtractRanges(range, mergedOccupied))
    .map((gap) => ({
      startMinute: Math.max(gap.startMinute, earliestMinute),
      endMinute: gap.endMinute,
    }))
    .filter((gap) => gap.endMinute - gap.startMinute >= requiredMinutes)
    .sort((a, b) => a.startMinute - b.startMinute);

  return gaps.slice(0, maxResults).map((gap) => ({
    startMinute: gap.startMinute,
    endMinute: gap.endMinute,
    durationMinutes: gap.endMinute - gap.startMinute,
  }));
}
