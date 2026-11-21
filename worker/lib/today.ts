import { addDays, startOfWeek, weekdayOf } from "../../shared/dates.ts";
import type { DayStatus } from "../../shared/schemas.ts";
import { currentStreak, type DayRow } from "../../shared/streak.ts";
import { closePastDays } from "./day-log.ts";

export type TodayState = "completed" | "pending" | "rest";

interface ScheduledDay {
  kind: "session" | "rest";
  title: string;
  exerciseCount: number;
}

/** Lo que dice la rutina activa para un dia de la semana (1..7); null si no hay rutina activa. */
export async function scheduledFor(db: D1Database, profileId: number, weekday: number): Promise<ScheduledDay | null> {
  const row = await db
    .prepare(
      `SELECT rd.kind AS kind, rd.title AS title,
              (SELECT COUNT(*) FROM routine_day_exercises WHERE routine_day_id = rd.id) AS count
       FROM routines r JOIN routine_days rd ON rd.routine_id = r.id AND rd.weekday = ?
       WHERE r.profile_id = ? AND r.is_active = 1`,
    )
    .bind(weekday, profileId)
    .first<{ kind: "session" | "rest"; title: string; count: number }>();
  return row ? { kind: row.kind, title: row.title, exerciseCount: row.count } : null;
}

/** Estado de hoy en vivo: completado si hay una sesion terminada hoy; si no, segun la rutina. */
export async function todayState(db: D1Database, profileId: number, today: string): Promise<TodayState> {
  const done = await db
    .prepare("SELECT 1 AS x FROM sessions WHERE profile_id = ? AND local_date = ? AND status = 'completed' LIMIT 1")
    .bind(profileId, today)
    .first();
  if (done) return "completed";
  const scheduled = await scheduledFor(db, profileId, weekdayOf(today));
  return scheduled?.kind === "session" ? "pending" : "rest";
}

/** Racha actual del perfil. Cierra antes los dias pasados pendientes de materializar. */
export async function streakOf(db: D1Database, profileId: number, today: string): Promise<number> {
  await closePastDays(db, profileId, today);
  const { results } = await db
    .prepare("SELECT date, status FROM day_log WHERE profile_id = ? ORDER BY date DESC LIMIT 400")
    .bind(profileId)
    .all<DayRow>();
  return currentStreak(results);
}

export async function sessionsThisWeek(db: D1Database, profileId: number, today: string): Promise<number> {
  const start = startOfWeek(today);
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM sessions WHERE profile_id = ? AND status = 'completed' AND local_date BETWEEN ? AND ?")
    .bind(profileId, start, addDays(start, 6))
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export interface WeekDay {
  date: string;
  weekday: number;
  /** null para dias futuros, que aun no tienen estado */
  status: DayStatus | null;
  kind: "session" | "rest";
}

/** Los siete dias de la semana (lunes a domingo) con su estado y lo programado. */
export async function weekOf(db: D1Database, profileId: number, today: string): Promise<WeekDay[]> {
  const start = startOfWeek(today);
  const end = addDays(start, 6);
  const [{ results: rows }, { results: kinds }] = await Promise.all([
    db.prepare("SELECT date, status FROM day_log WHERE profile_id = ? AND date BETWEEN ? AND ?").bind(profileId, start, end).all<DayRow>(),
    db
      .prepare(
        `SELECT rd.weekday AS weekday, rd.kind AS kind FROM routines r JOIN routine_days rd ON rd.routine_id = r.id
         WHERE r.profile_id = ? AND r.is_active = 1`,
      )
      .bind(profileId)
      .all<{ weekday: number; kind: "session" | "rest" }>(),
  ]);
  const byDate = new Map(rows.map((r) => [r.date, r.status]));
  const kindOf = new Map(kinds.map((k) => [k.weekday, k.kind]));
  const todayStatus = await todayState(db, profileId, today);
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const weekday = i + 1;
    let status: DayStatus | null = null;
    if (date < today) status = byDate.get(date) ?? null;
    else if (date === today) status = todayStatus;
    days.push({ date, weekday, status, kind: kindOf.get(weekday) ?? "rest" });
  }
  return days;
}
