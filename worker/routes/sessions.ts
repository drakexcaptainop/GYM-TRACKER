import { Hono } from "hono";
import { localDate, weekdayOf } from "../../shared/dates.ts";
import { exerciseDoneSchema, sessionPatchSchema, setSchema, startSessionSchema } from "../../shared/schemas.ts";
import type { AppEnv } from "../env.ts";
import { closePastDays, recordFinishedDay } from "../lib/day-log.ts";
import { fail, readBody } from "../lib/http.ts";
import { loadSession, summarize } from "../lib/sessions.ts";

export const sessionRoutes = new Hono<AppEnv>();

// Empezar copia lo planeado para hoy; repetir la llamada con el mismo id no duplica nada.
sessionRoutes.post("/sessions/start", async (c) => {
  const profileId = c.get("profileId");
  const db = c.env.DB;
  const { id } = await readBody(c, startSessionSchema);

  const existing = await db.prepare("SELECT profile_id FROM sessions WHERE id = ?").bind(id).first<{ profile_id: number }>();
  if (existing) {
    if (existing.profile_id !== profileId) fail(404, "not_found");
    return c.json({ session: await loadSession(db, profileId, id) });
  }

  const open = await db
    .prepare("SELECT id FROM sessions WHERE profile_id = ? AND status != 'completed' LIMIT 1")
    .bind(profileId)
    .first<{ id: string }>();
  if (open) return c.json({ error: "session_open", id: open.id }, 409);

  const now = Date.now();
  const today = localDate(now);
  await closePastDays(db, profileId, today);

  const day = await db
    .prepare(
      `SELECT rd.id AS id, rd.title AS title, rd.warmup_enabled AS warmup, r.id AS routine_id, r.name AS routine_name
       FROM routines r JOIN routine_days rd ON rd.routine_id = r.id AND rd.weekday = ?
       WHERE r.profile_id = ? AND r.is_active = 1`,
    )
    .bind(weekdayOf(today), profileId)
    .first<{ id: number; title: string; warmup: number; routine_id: number; routine_name: string }>();
  if (!day) fail(409, "no_routine_today");

  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM routine_day_exercises WHERE routine_day_id = ?")
    .bind(day.id)
    .first<{ n: number }>();
  if (!count || count.n === 0) fail(409, "no_exercises_today");

  const { results: warmup } = day.warmup
    ? await db
        .prepare("SELECT name, detail FROM routine_warmup_items WHERE routine_id = ? ORDER BY position")
        .bind(day.routine_id)
        .all<{ name: string; detail: string }>()
    : { results: [] as { name: string; detail: string }[] };

  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO sessions (id, profile_id, local_date, routine_name, day_title, status, started_at) VALUES (?, ?, ?, ?, ?, 'in_progress', ?)",
      )
      .bind(id, profileId, today, day.routine_name, day.title, now),
    ...warmup.map((w, i) =>
      db
        .prepare("INSERT OR IGNORE INTO session_exercises (session_id, position, kind, name, detail, measure) VALUES (?, ?, 'warmup', ?, ?, 'none')")
        .bind(id, i + 1, w.name, w.detail),
    ),
    db
      .prepare(
        `INSERT OR IGNORE INTO session_exercises
           (session_id, position, kind, exercise_id, name, measure, role, sets_planned, target_min, target_max, weight_planned, rest_seconds)
         SELECT ?, ROW_NUMBER() OVER (ORDER BY rde.position) + ?, 'exercise', e.id, e.name, e.measure, rde.role,
                rde.sets, rde.target_min, rde.target_max, rde.weight_kg, rde.rest_seconds
         FROM routine_day_exercises rde JOIN exercises e ON e.id = rde.exercise_id
         WHERE rde.routine_day_id = ?`,
      )
      .bind(id, warmup.length, day.id),
  ]);
  return c.json({ session: await loadSession(db, profileId, id) }, 201);
});

sessionRoutes.get("/sessions/current", async (c) => {
  const profileId = c.get("profileId");
  const open = await c.env.DB.prepare("SELECT id FROM sessions WHERE profile_id = ? AND status != 'completed' LIMIT 1")
    .bind(profileId)
    .first<{ id: string }>();
  return c.json({ session: open ? await loadSession(c.env.DB, profileId, open.id) : null });
});

sessionRoutes.get("/sessions/:id", async (c) => {
  const session = await loadSession(c.env.DB, c.get("profileId"), c.req.param("id"));
  if (!session) fail(404, "not_found");
  return c.json({ session, summary: session.status === "completed" ? summarize(session) : null });
});

// Pausar, retomar y guardar el punto donde va la persona.
sessionRoutes.patch("/sessions/:id", async (c) => {
  const profileId = c.get("profileId");
  const id = c.req.param("id");
  const body = await readBody(c, sessionPatchSchema);
  const session = await loadSession(c.env.DB, profileId, id);
  if (!session) fail(404, "not_found");
  if (session.status === "completed") fail(409, "session_completed");
  await c.env.DB.prepare("UPDATE sessions SET status = COALESCE(?, status), position = ? WHERE id = ?")
    .bind(body.status ?? null, body.position === undefined ? session.position : body.position, id)
    .run();
  return c.json({ ok: true });
});

// Registrar una serie es idempotente: reenviar la misma serie no crea otra fila; reenviarla con otros valores la corrige.
sessionRoutes.put("/sessions/:id/sets", async (c) => {
  const profileId = c.get("profileId");
  const id = c.req.param("id");
  const body = await readBody(c, setSchema);
  const owned = await c.env.DB.prepare(
    `SELECT s.status AS status FROM session_exercises se JOIN sessions s ON s.id = se.session_id
     WHERE se.id = ? AND se.session_id = ? AND s.profile_id = ?`,
  )
    .bind(body.sessionExerciseId, id, profileId)
    .first<{ status: string }>();
  if (!owned) fail(404, "not_found");
  if (owned.status === "completed") fail(409, "session_completed");
  const completedAt = Math.min(body.completedAt ?? Date.now(), Date.now());
  await c.env.DB.prepare(
    `INSERT INTO session_sets (session_exercise_id, kind, set_number, value, weight_kg, completed_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_exercise_id, kind, set_number) DO UPDATE SET value = excluded.value, weight_kg = excluded.weight_kg`,
  )
    .bind(body.sessionExerciseId, body.kind, body.setNumber, body.value, body.weightKg, completedAt)
    .run();
  return c.json({ ok: true });
});

// Completar una serie y completar un ejercicio son acciones distintas.
sessionRoutes.put("/sessions/:id/exercises/:exerciseId/done", async (c) => {
  const profileId = c.get("profileId");
  const { done } = await readBody(c, exerciseDoneSchema);
  const result = await c.env.DB.prepare(
    `UPDATE session_exercises SET done = ?
     WHERE id = ? AND session_id = ? AND session_id IN (SELECT id FROM sessions WHERE profile_id = ? AND status != 'completed')`,
  )
    .bind(done ? 1 : 0, Number(c.req.param("exerciseId")), c.req.param("id"), profileId)
    .run();
  if (result.meta.changes === 0) fail(404, "not_found");
  return c.json({ ok: true });
});

// Terminar de forma explicita: es lo unico que cuenta como entrenamiento completado.
sessionRoutes.post("/sessions/:id/finish", async (c) => {
  const profileId = c.get("profileId");
  const db = c.env.DB;
  const id = c.req.param("id");
  const session = await loadSession(db, profileId, id);
  if (!session) fail(404, "not_found");

  if (session.status !== "completed") {
    const now = Date.now();
    await db
      .prepare("UPDATE sessions SET status = 'completed', ended_at = ?, duration_seconds = ?, position = NULL WHERE id = ? AND status != 'completed'")
      .bind(now, Math.max(0, Math.round((now - session.startedAt) / 1000)), id)
      .run();
  }
  // Idempotente: si un intento anterior terminó la sesión pero falló aquí, reintentar lo completa.
  await recordFinishedDay(db, profileId, session.localDate, id);
  const finished = (await loadSession(db, profileId, id))!;
  return c.json({ session: finished, summary: summarize(finished) });
});
