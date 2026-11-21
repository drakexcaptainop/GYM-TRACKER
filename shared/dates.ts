// Fechas locales en America/La_Paz (UTC-4 todo el año, sin horario de verano).

const TZ_OFFSET_MS = -4 * 60 * 60 * 1000;

/** Fecha local YYYY-MM-DD de un instante en milisegundos. */
export function localDate(nowMs: number): string {
  return new Date(nowMs + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunes ... 7 = domingo */
export function weekdayOf(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(date: string): string {
  return addDays(date, -(weekdayOf(date) - 1));
}

/** Fechas desde `from` hasta `to`, ambas incluidas. Vacio si from > to. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
