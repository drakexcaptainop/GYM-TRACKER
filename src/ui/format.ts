import type { Measure } from "../lib/types.ts";

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const WEEKDAYS_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

const MEASURE_UNIT: Record<Measure, string> = {
  reps: "repeticiones",
  reps_side: "repeticiones por lado",
  seconds: "segundos",
  seconds_side: "segundos por lado",
  minutes: "minutos",
  none: "",
};

export function measureUnit(measure: Measure): string {
  return MEASURE_UNIT[measure];
}

/** "12–15" o "12"; vacío si no hay objetivo. */
export function targetText(min: number | null, max: number | null): string {
  if (min === null && max === null) return "";
  if (min === null || max === null || min === max) return String(min ?? max);
  return `${min}–${max}`;
}

/** Resumen corto de lo que se pide, por ejemplo "3 × 12–15 repeticiones". */
export function prescriptionText(item: { sets: number | null; targetMin: number | null; targetMax: number | null; measure: Measure }): string {
  const target = targetText(item.targetMin, item.targetMax);
  const unit = measureUnit(item.measure);
  const goal = [target, unit].filter(Boolean).join(" ");
  if (item.sets && goal) return `${item.sets} × ${goal}`;
  return goal || (item.measure === "none" ? "Hasta terminar" : "");
}

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function minutesText(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.max(1, Math.round(seconds / 60));
  return `${m} min`;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2 nov" a partir de YYYY-MM-DD. */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}
