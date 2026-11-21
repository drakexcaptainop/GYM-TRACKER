import type { DayStatus } from "./schemas.ts";

export interface DayRow {
  date: string;
  status: DayStatus;
}

/**
 * Racha actual: recorre del dia mas reciente al mas antiguo, suma los completados,
 * salta los descansos y se detiene en el primer pendiente.
 * Los dias de hoy aun abiertos no tienen fila, asi que no la rompen.
 */
export function currentStreak(rowsNewestFirst: DayRow[]): number {
  let streak = 0;
  for (const row of rowsNewestFirst) {
    if (row.status === "completed") streak++;
    else if (row.status === "pending") break;
  }
  return streak;
}
