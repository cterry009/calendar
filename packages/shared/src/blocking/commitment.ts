// The block commitment as the clients see it (weekend-mode, user 2026-11-04: "que no se pueda cerrar
// la aplicación, por lo menos por una semana"). The server owns it (BlockCommitment, /commitment) and
// refuses what weakens the night block; the apps read it from the sync snapshot to lock their switches
// and to arm the native guards.

export interface CommitmentView {
  startedAt: string;
  /** Null = indefinitely. */
  endsAt: string | null;
  active: boolean;
}

/** Android's "indefinitely": larger than any epoch ms, read back as Long.MAX_VALUE. */
export const COMMITMENT_FOREVER_MS = 9.3e18;

/** By the clock, not the `active` of the last pull: it has to end on time offline too. */
export function isCommitmentActive(commitment: CommitmentView | null | undefined, now = new Date()): boolean {
  if (!commitment) return false;
  return commitment.endsAt === null || new Date(commitment.endsAt) > now;
}

/** Epoch ms for the native side: 0 = none. */
export function commitmentUntilMs(commitment: CommitmentView | null | undefined): number {
  if (!commitment) return 0;
  return commitment.endsAt === null ? COMMITMENT_FOREVER_MS : new Date(commitment.endsAt).getTime();
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "Hasta el 11 nov, 08:30", "Indefinido". */
export function commitmentText(commitment: CommitmentView): string {
  if (commitment.endsAt === null) return 'Indefinido';
  const end = new Date(commitment.endsAt);
  const time = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  return `Hasta el ${end.getDate()} ${MONTHS[end.getMonth()]}, ${time}`;
}
