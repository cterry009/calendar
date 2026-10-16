// Pomodoro sequences (horario 2026-10-19): a block is split into an editable list of segments of
// different lengths -- the morning one is 30 + 5 + 40 + 15 + 40 + 10 + 20 + 5 + 15 -- instead of
// one pomodoro length repeated. Segments are anchored to the block's start: segment i always runs
// at the same clock time, so starting late joins the segment running now, and "cortar tramo" only
// starts the next pause early, never moving the block's end.

export const SEQUENCE_SEGMENT_TYPES = ['foco', 'pausa', 'cierre'] as const;
export type SequenceSegmentType = (typeof SEQUENCE_SEGMENT_TYPES)[number];

export interface SequenceSegment {
  tipo: SequenceSegmentType;
  minutos: number;
  etiqueta: string;
}

/** A segment placed in its block: minutes from the block's start. */
export interface TimedSegment extends SequenceSegment {
  index: number;
  startOffset: number;
  endOffset: number;
  /** Shortened (or emptied) so the sequence ends at the block's end. */
  trimmed: boolean;
}

export interface FittedSequence {
  segments: TimedSegment[];
  /** Spanish, for the user: the sequence didn't add up to the block. Null when it does. */
  warning: string | null;
}

export function sequenceMinutes(sequence: SequenceSegment[]): number {
  return sequence.reduce((sum, segment) => sum + segment.minutos, 0);
}

/**
 * Places a sequence in a block of `blockMinutes`. The block always ends at its fixed time: a longer
 * sequence loses minutes from its last segment (and the ones before it, if that isn't enough); a
 * shorter one just ends early. Either way the warning says so.
 */
export function fitSequence(sequence: SequenceSegment[], blockMinutes: number): FittedSequence {
  const total = sequenceMinutes(sequence);
  const segments: TimedSegment[] = [];
  let t = 0;
  sequence.forEach((segment, index) => {
    const endOffset = Math.min(t + segment.minutos, blockMinutes);
    if (endOffset > t) {
      segments.push({ ...segment, index: segments.length, startOffset: t, endOffset, trimmed: endOffset - t < segment.minutos });
    }
    t = endOffset;
  });
  let warning: string | null = null;
  if (total > blockMinutes) {
    warning = `La secuencia dura ${total} min y el bloque ${blockMinutes}: se recortó el último tramo.`;
  } else if (total < blockMinutes) {
    warning = `La secuencia dura ${total} min y el bloque ${blockMinutes}: sobran ${blockMinutes - total} min al final.`;
  }
  return { segments, warning };
}

/** Index of the segment running `offsetMin` minutes into the block (0 before it starts, -1 after the last one). */
export function segmentIndexAt(segments: TimedSegment[], offsetMin: number): number {
  if (segments.length === 0) return -1;
  if (offsetMin < 0) return 0;
  const index = segments.findIndex((segment) => offsetMin >= segment.startOffset && offsetMin < segment.endOffset);
  return index;
}

/** Focus and closing segments count as work (and block apps); only a focus segment is a pomodoro. */
export function isWorkSegment(segment: Pick<SequenceSegment, 'tipo'>): boolean {
  return segment.tipo !== 'pausa';
}

/** Pomodoros (focus segments) in a sequence. */
export function focusSegmentCount(sequence: SequenceSegment[]): number {
  return sequence.filter((segment) => segment.tipo === 'foco').length;
}

/** "Pomodoro 2" is a placeholder label: the category's suggested pomodoros replace it. */
const PLACEHOLDER_LABEL = /^Pomodoro \d+$/;

/**
 * The sequence with its placeholder focus labels replaced by the category's suggestions, in order
 * (afternoon and Saturday blocks: "Pomodoro 1" -> "Planear y escribir"). Labels the user wrote, and
 * the morning ones, are left alone.
 */
export function labelSequence(sequence: SequenceSegment[], suggestions: string[] | undefined): SequenceSegment[] {
  if (!suggestions?.length) return sequence;
  let focusIndex = 0;
  return sequence.map((segment) => {
    if (segment.tipo !== 'foco') return segment;
    const suggestion = suggestions[focusIndex++];
    return suggestion && PLACEHOLDER_LABEL.test(segment.etiqueta) ? { ...segment, etiqueta: suggestion } : segment;
  });
}
