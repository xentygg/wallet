const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Fecha local como YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Mes actual como YYYY-MM. */
export function currentMonth(): string {
  return toDateKey(new Date()).slice(0, 7);
}

/** "2026-11" -> "Noviembre 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

/** "2026-11-05" -> "5 de noviembre" */
export function formatDay(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

/** Desplaza un mes "YYYY-MM" en `delta` meses. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return toDateKey(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

/** Desplaza una fecha "YYYY-MM-DD" en `delta` días. */
export function shiftDay(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + delta));
}
