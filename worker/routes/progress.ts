import { Hono } from "hono";
import { addDays, localDate, startOfWeek } from "../../shared/dates.ts";
import type { AppEnv } from "../env.ts";
import { closePastDays } from "../lib/day-log.ts";
import { fail, intParam } from "../lib/http.ts";

export const progressRoutes = new Hono<AppEnv>();

const DEFAULT_DAYS = 90;
const WEEKS = 12;

function daysParam(raw: string | undefined): number {
  const value = Number(raw ?? DEFAULT_DAYS);
  return Number.isInteger(value) && value >= 1 && value <= 365 ? value : DEFAULT_DAYS;
}

// Totales, sesiones por semana y cumplimiento de la rutina. Es privado: solo del perfil que consulta.
progressRoutes.get("/progress", async (c) => {
  const profileId = c.get("profileId");
  const db = c.env.DB;
  const today = localDate(Date.now());
  await closePastDays(db, profileId, today);
  const from = addDays(today, -(daysParam(c.req.query("days")) - 1));
  const weeksFrom = addDays(startOfWeek(today), -7 * (WEEKS - 1));

  const [total, sessions, days] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE profile_id = ? AND status = 'completed'").bind(profileId).first<{ n: number }>(),
    db
      .prepare("SELECT local_date FROM sessions WHERE profile_id = ? AND status = 'completed' AND local_date >= ?")
      .bind(profileId, weeksFrom)
      .all<{ local_date: string }>(),
    db
      .prepare("SELECT status, COUNT(*) AS n FROM day_log WHERE profile_id = ? AND date BETWEEN ? AND ? GROUP BY status")
      .bind(profileId, from, today)
      .all<{ status: string; n: number }>(),
  ]);

  const perWeek = new Map<string, number>();
  for (let i = 0; i < WEEKS; i++) perWeek.set(addDays(weeksFrom, 7 * i), 0);
  for (const row of sessions.results) {
    const week = startOfWeek(row.local_date);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }

  const count = (status: string) => days.results.find((r) => r.status === status)?.n ?? 0;
  const scheduled = count("completed") + count("pending");

  return c.json({
    completedSessions: total?.n ?? 0,
    sessionsPerWeek: [...perWeek.entries()].map(([weekStart, sessions]) => ({ weekStart, sessions })),
    compliance: scheduled === 0 ? null : Math.round((count("completed") / scheduled) * 100),
    from,
    to: today,
  });
});

// Historial cronologico, del mas reciente al mas antiguo, con cursor.
progressRoutes.get("/progress/history", async (c) => {
  const profileId = c.get("profileId");
  const before = Number(c.req.query("before") ?? Number.MAX_SAFE_INTEGER);
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 20) || 20, 1), 50);
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.local_date, s.routine_name, s.day_title, s.duration_seconds, s.started_at,
            (SELECT COUNT(*) FROM session_exercises WHERE session_id = s.id AND kind = 'exercise' AND done = 1) AS exercises_completed,
            (SELECT COUNT(*) FROM session_sets ss JOIN session_exercises se ON se.id = ss.session_exercise_id
              WHERE se.session_id = s.id AND se.kind = 'exercise' AND ss.kind = 'work') AS sets_done
     FROM sessions s
     WHERE s.profile_id = ? AND s.status = 'completed' AND s.started_at < ?
     ORDER BY s.started_at DESC LIMIT ?`,
  )
    .bind(profileId, before, limit)
    .all<{
      id: string;
      local_date: string;
      routine_name: string;
      day_title: string;
      duration_seconds: number | null;
      started_at: number;
      exercises_completed: number;
      sets_done: number;
    }>();
  return c.json({
    sessions: results.map((r) => ({
      id: r.id,
      localDate: r.local_date,
      routineName: r.routine_name,
      dayTitle: r.day_title,
      durationSeconds: r.duration_seconds,
      exercisesCompleted: r.exercises_completed,
      setsDone: r.sets_done,
    })),
    nextBefore: results.length === limit ? results[results.length - 1]!.started_at : null,
  });
});

// Ejercicios con registros, para elegir cual graficar. El nombre es el de la copia en la sesion.
progressRoutes.get("/progress/exercises", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT se.exercise_id AS id, se.name AS name, MAX(s.started_at) AS last_at
     FROM session_exercises se JOIN sessions s ON s.id = se.session_id
     WHERE s.profile_id = ? AND s.status = 'completed' AND se.kind = 'exercise' AND se.exercise_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM session_sets WHERE session_exercise_id = se.id AND kind = 'work')
     GROUP BY se.exercise_id ORDER BY last_at DESC`,
  )
    .bind(c.get("profileId"))
    .all<{ id: number; name: string }>();
  return c.json({ exercises: results.map((r) => ({ id: r.id, name: r.name })) });
});

// Evolucion de un ejercicio: por sesion, el mayor peso y las repeticiones del mejor set.
progressRoutes.get("/progress/exercises/:exerciseId", async (c) => {
  const profileId = c.get("profileId");
  const exerciseId = intParam(c, "exerciseId");
  const from = addDays(localDate(Date.now()), -(daysParam(c.req.query("days")) - 1));
  const { results } = await c.env.DB.prepare(
    `SELECT s.local_date AS date, se.name AS name, se.measure AS measure,
            MAX(ss.weight_kg) AS best_weight, MAX(ss.value) AS best_value, SUM(ss.value) AS total_value, COUNT(ss.id) AS sets
     FROM session_exercises se
     JOIN sessions s ON s.id = se.session_id
     JOIN session_sets ss ON ss.session_exercise_id = se.id AND ss.kind = 'work'
     WHERE se.exercise_id = ? AND s.profile_id = ? AND s.status = 'completed' AND s.local_date >= ?
     GROUP BY s.id ORDER BY s.local_date`,
  )
    .bind(exerciseId, profileId, from)
    .all<{ date: string; name: string; measure: string; best_weight: number | null; best_value: number | null; total_value: number | null; sets: number }>();
  if (results.length === 0) fail(404, "not_found");
  return c.json({
    name: results[results.length - 1]!.name,
    measure: results[results.length - 1]!.measure,
    points: results.map((r) => ({
      date: r.date,
      name: r.name,
      bestWeightKg: r.best_weight,
      bestValue: r.best_value,
      totalValue: r.total_value,
      sets: r.sets,
    })),
  });
});
