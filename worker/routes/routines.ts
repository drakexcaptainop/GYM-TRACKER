import { Hono } from "hono";
import { localDate } from "../../shared/dates.ts";
import {
  dayExerciseCreateSchema,
  dayExercisePatchSchema,
  dayPatchSchema,
  duplicateSchema,
  orderSchema,
  routineCreateSchema,
  routinePatchSchema,
  warmupSchema,
} from "../../shared/schemas.ts";
import type { AppEnv } from "../env.ts";
import { closePastDays } from "../lib/day-log.ts";
import { fail, intParam, readBody, weekdayParam } from "../lib/http.ts";
import { loadRoutine } from "../lib/routines.ts";
import { visibleExercise } from "./exercises.ts";

export const routineRoutes = new Hono<AppEnv>();

/** Antes de cualquier cambio se cierran los dias pasados, para no reescribir el pasado. */
async function beforeChange(db: D1Database, profileId: number) {
  await closePastDays(db, profileId, localDate(Date.now()));
}

async function ownedRoutineId(db: D1Database, profileId: number, id: number): Promise<number> {
  const row = await db.prepare("SELECT id FROM routines WHERE id = ? AND profile_id = ?").bind(id, profileId).first<{ id: number }>();
  if (!row) fail(404, "not_found");
  return row.id;
}

async function dayOf(db: D1Database, routineId: number, weekday: number): Promise<{ id: number; kind: string }> {
  const row = await db
    .prepare("SELECT id, kind FROM routine_days WHERE routine_id = ? AND weekday = ?")
    .bind(routineId, weekday)
    .first<{ id: number; kind: string }>();
  if (!row) fail(404, "not_found");
  return row;
}

routineRoutes.get("/routines", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, description, is_active, reduced_volume_until FROM routines WHERE profile_id = ? ORDER BY is_active DESC, name",
  )
    .bind(c.get("profileId"))
    .all<{ id: number; name: string; description: string; is_active: number; reduced_volume_until: string | null }>();
  return c.json({
    routines: results.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: r.is_active === 1,
      reducedVolumeUntil: r.reduced_volume_until,
    })),
  });
});

routineRoutes.get("/routines/active", async (c) => {
  const profileId = c.get("profileId");
  const row = await c.env.DB.prepare("SELECT id FROM routines WHERE profile_id = ? AND is_active = 1").bind(profileId).first<{ id: number }>();
  if (!row) return c.json({ routine: null });
  return c.json({ routine: await loadRoutine(c.env.DB, profileId, row.id) });
});

routineRoutes.post("/routines", async (c) => {
  const profileId = c.get("profileId");
  const body = await readBody(c, routineCreateSchema);
  await beforeChange(c.env.DB, profileId);
  const created = await c.env.DB.prepare("INSERT INTO routines (profile_id, name, description, is_active, created_at) VALUES (?, ?, ?, 0, ?)")
    .bind(profileId, body.name, body.description, Date.now())
    .run();
  const id = created.meta.last_row_id;
  await c.env.DB.batch(
    [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
      c.env.DB.prepare("INSERT INTO routine_days (routine_id, weekday, kind, title, warmup_enabled) VALUES (?, ?, 'rest', 'Descanso', 0)").bind(
        id,
        weekday,
      ),
    ),
  );
  return c.json({ id }, 201);
});

routineRoutes.get("/routines/:id", async (c) => {
  const routine = await loadRoutine(c.env.DB, c.get("profileId"), intParam(c, "id"));
  if (!routine) fail(404, "not_found");
  return c.json({ routine });
});

routineRoutes.patch("/routines/:id", async (c) => {
  const profileId = c.get("profileId");
  const id = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  const body = await readBody(c, routinePatchSchema);
  await c.env.DB.prepare("UPDATE routines SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?")
    .bind(body.name ?? null, body.description ?? null, id)
    .run();
  return c.json({ ok: true });
});

routineRoutes.post("/routines/:id/duplicate", async (c) => {
  const profileId = c.get("profileId");
  const id = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  const body = await readBody(c, duplicateSchema);
  const db = c.env.DB;
  const source = await db.prepare("SELECT name, description FROM routines WHERE id = ?").bind(id).first<{ name: string; description: string }>();
  const created = await db
    .prepare("INSERT INTO routines (profile_id, name, description, is_active, created_at) VALUES (?, ?, ?, 0, ?)")
    .bind(profileId, body.name ?? `${source!.name} (copia)`, source!.description, Date.now())
    .run();
  const newId = created.meta.last_row_id;
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO routine_days (routine_id, weekday, kind, title, warmup_enabled)
           SELECT ?, weekday, kind, title, warmup_enabled FROM routine_days WHERE routine_id = ?`,
        )
        .bind(newId, id),
      db
        .prepare(
          `INSERT INTO routine_day_exercises (routine_day_id, exercise_id, position, sets, target_min, target_max, weight_kg, rest_seconds, role)
           SELECT nd.id, e.exercise_id, e.position, e.sets, e.target_min, e.target_max, e.weight_kg, e.rest_seconds, e.role
           FROM routine_day_exercises e
           JOIN routine_days od ON od.id = e.routine_day_id
           JOIN routine_days nd ON nd.routine_id = ? AND nd.weekday = od.weekday
           WHERE od.routine_id = ?`,
        )
        .bind(newId, id),
      db
        .prepare("INSERT INTO routine_warmup_items (routine_id, position, name, detail) SELECT ?, position, name, detail FROM routine_warmup_items WHERE routine_id = ?")
        .bind(newId, id),
    ]);
  } catch (error) {
    await db.prepare("DELETE FROM routines WHERE id = ?").bind(newId).run();
    throw error;
  }
  return c.json({ id: newId }, 201);
});

routineRoutes.post("/routines/:id/activate", async (c) => {
  const profileId = c.get("profileId");
  const id = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  await beforeChange(c.env.DB, profileId);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE routines SET is_active = 0 WHERE profile_id = ? AND is_active = 1").bind(profileId),
    c.env.DB.prepare("UPDATE routines SET is_active = 1 WHERE id = ?").bind(id),
  ]);
  return c.json({ ok: true });
});

routineRoutes.post("/routines/:id/deactivate", async (c) => {
  const profileId = c.get("profileId");
  const id = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  await beforeChange(c.env.DB, profileId);
  await c.env.DB.prepare("UPDATE routines SET is_active = 0 WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

routineRoutes.delete("/routines/:id", async (c) => {
  const profileId = c.get("profileId");
  const id = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  await beforeChange(c.env.DB, profileId);
  await c.env.DB.prepare("DELETE FROM routines WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

routineRoutes.put("/routines/:id/warmup", async (c) => {
  const profileId = c.get("profileId");
  const id = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  const body = await readBody(c, warmupSchema);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM routine_warmup_items WHERE routine_id = ?").bind(id),
    ...body.items.map((item, i) =>
      c.env.DB.prepare("INSERT INTO routine_warmup_items (routine_id, position, name, detail) VALUES (?, ?, ?, ?)").bind(id, i + 1, item.name, item.detail),
    ),
  ]);
  return c.json({ ok: true });
});

routineRoutes.patch("/routines/:id/days/:weekday", async (c) => {
  const profileId = c.get("profileId");
  const routineId = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  const day = await dayOf(c.env.DB, routineId, weekdayParam(c));
  const body = await readBody(c, dayPatchSchema);
  await beforeChange(c.env.DB, profileId);
  await c.env.DB.prepare(
    "UPDATE routine_days SET kind = COALESCE(?, kind), title = COALESCE(?, title), warmup_enabled = COALESCE(?, warmup_enabled) WHERE id = ?",
  )
    .bind(body.kind ?? null, body.title ?? null, body.warmupEnabled === undefined ? null : body.warmupEnabled ? 1 : 0, day.id)
    .run();
  return c.json({ ok: true });
});

routineRoutes.post("/routines/:id/days/:weekday/exercises", async (c) => {
  const profileId = c.get("profileId");
  const routineId = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  const day = await dayOf(c.env.DB, routineId, weekdayParam(c));
  const body = await readBody(c, dayExerciseCreateSchema);
  const exercise = await visibleExercise(c.env.DB, profileId, body.exerciseId);
  const created = await c.env.DB.prepare(
    `INSERT INTO routine_day_exercises (routine_day_id, exercise_id, position, sets, target_min, target_max, weight_kg, rest_seconds, role)
     VALUES (?, ?, COALESCE((SELECT MAX(position) FROM routine_day_exercises WHERE routine_day_id = ?), 0) + 1, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      day.id,
      exercise.id,
      day.id,
      body.sets ?? null,
      body.targetMin ?? null,
      body.targetMax ?? null,
      body.weightKg ?? null,
      body.restSeconds ?? null,
      body.role ?? exercise.role,
    )
    .run();
  return c.json({ id: created.meta.last_row_id }, 201);
});

routineRoutes.put("/routines/:id/days/:weekday/order", async (c) => {
  const profileId = c.get("profileId");
  const routineId = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  const day = await dayOf(c.env.DB, routineId, weekdayParam(c));
  const { itemIds } = await readBody(c, orderSchema);
  const { results } = await c.env.DB.prepare("SELECT id FROM routine_day_exercises WHERE routine_day_id = ?").bind(day.id).all<{ id: number }>();
  const current = results.map((r) => r.id).sort((a, b) => a - b);
  const wanted = [...itemIds].sort((a, b) => a - b);
  if (current.length !== wanted.length || current.some((v, i) => v !== wanted[i])) fail(400, "invalid_order");
  await c.env.DB.batch(
    itemIds.map((itemId, i) => c.env.DB.prepare("UPDATE routine_day_exercises SET position = ? WHERE id = ? AND routine_day_id = ?").bind(i + 1, itemId, day.id)),
  );
  return c.json({ ok: true });
});

routineRoutes.patch("/routines/:id/days/:weekday/exercises/:itemId", async (c) => {
  const profileId = c.get("profileId");
  const routineId = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  const day = await dayOf(c.env.DB, routineId, weekdayParam(c));
  const itemId = intParam(c, "itemId");
  const body = await readBody(c, dayExercisePatchSchema);
  const sets: string[] = [];
  const values: (number | string | null)[] = [];
  const columns: [keyof typeof body, string][] = [
    ["sets", "sets"],
    ["targetMin", "target_min"],
    ["targetMax", "target_max"],
    ["weightKg", "weight_kg"],
    ["restSeconds", "rest_seconds"],
    ["role", "role"],
  ];
  for (const [key, column] of columns) {
    if (body[key] !== undefined) {
      sets.push(`${column} = ?`);
      values.push(body[key] as number | string | null);
    }
  }
  if (sets.length === 0) return c.json({ ok: true });
  const result = await c.env.DB.prepare(`UPDATE routine_day_exercises SET ${sets.join(", ")} WHERE id = ? AND routine_day_id = ?`)
    .bind(...values, itemId, day.id)
    .run();
  if (result.meta.changes === 0) fail(404, "not_found");
  return c.json({ ok: true });
});

routineRoutes.delete("/routines/:id/days/:weekday/exercises/:itemId", async (c) => {
  const profileId = c.get("profileId");
  const routineId = await ownedRoutineId(c.env.DB, profileId, intParam(c, "id"));
  const day = await dayOf(c.env.DB, routineId, weekdayParam(c));
  const result = await c.env.DB.prepare("DELETE FROM routine_day_exercises WHERE id = ? AND routine_day_id = ?").bind(intParam(c, "itemId"), day.id).run();
  if (result.meta.changes === 0) fail(404, "not_found");
  return c.json({ ok: true });
});
