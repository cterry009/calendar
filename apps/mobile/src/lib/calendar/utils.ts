export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function minuteToTimeValue(totalMinutes: number): string {
  const boundedMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hours = Math.floor(boundedMinutes / 60);
  const minutes = boundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// 0=Sunday..6=Saturday, matches JS Date.getDay() (same convention the server's daysOfWeek uses).
const DAY_ABBREVIATIONS_ES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export function formatDaysOfWeek(daysOfWeek: number[]): string {
  return [...daysOfWeek]
    .sort((a, b) => a - b)
    .map((day) => DAY_ABBREVIATIONS_ES[day])
    .join(', ');
}
