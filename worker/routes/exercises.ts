import { Hono } from "hono";
import { exerciseCreateSchema, exercisePatchSchema, guideSchema } from "../../shared/schemas.ts";
import type { GuideInput } from "../../shared/schemas.ts";
import type { AppEnv } from "../env.ts";
import { fail, intParam, readBody } from "../lib/http.ts";
import { effectiveGuides } from "../lib/routines.ts";

interface ExerciseRow {
  id: number;
  slug: string | null;
  owner_profile_id: number | null;
  name: string;
  measure: string;
  role: string;
}

export const exerciseRoutes = new Hono<AppEnv>();

export async function visibleExercise(db: D1Database, profileId: number, id: number): Promise<ExerciseRow> {
  const row = await db
    .prepare(
      "SELECT id, slug, owner_profile_id, name, measure, role FROM exercises WHERE id = ? AND (owner_profile_id IS NULL OR owner_profile_id = ?)",
    )
    .bind(id, profileId)
    .first<ExerciseRow>();
  if (!row) fail(404, "not_found");
  return row;
}

function present(row: ExerciseRow) {
  return { id: row.id, name: row.name, measure: row.measure, role: row.role, own: row.owner_profile_id !== null };
}

async function writeGuide(db: D1Database, profileId: number, exerciseId: number, guide: GuideInput) {
  await db
    .prepare(
      `INSERT INTO guides (exercise_id, profile_id, muscles, materials, steps, tips, mistakes) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (exercise_id, profile_id) WHERE profile_id IS NOT NULL
       DO UPDATE SET muscles = excluded.muscles, materials = excluded.materials, steps = excluded.steps,
                     tips = excluded.tips, mistakes = excluded.mistakes`,
    )
    .bind(exerciseId, profileId, guide.muscles, guide.materials, JSON.stringify(guide.steps), guide.tips, guide.mistakes)
    .run();
}

exerciseRoutes.get("/exercises", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, slug, owner_profile_id, name, measure, role FROM exercises WHERE owner_profile_id IS NULL OR owner_profile_id = ? ORDER BY name",
  )
    .bind(c.get("profileId"))
    .all<ExerciseRow>();
  return c.json({ exercises: results.map(present) });
});

exerciseRoutes.get("/exercises/:id", async (c) => {
  const profileId = c.get("profileId");
  const exercise = await visibleExercise(c.env.DB, profileId, intParam(c, "id"));
  const guides = await effectiveGuides(c.env.DB, profileId, [exercise.id]);
  return c.json({ exercise: present(exercise), guide: guides[exercise.id] ?? null });
});

exerciseRoutes.post("/exercises", async (c) => {
  const profileId = c.get("profileId");
  const body = await readBody(c, exerciseCreateSchema);
  const created = await c.env.DB.prepare(
    "INSERT INTO exercises (owner_profile_id, name, measure, role, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(profileId, body.name, body.measure, body.role, Date.now())
    .run();
  const id = created.meta.last_row_id;
  if (body.guide) await writeGuide(c.env.DB, profileId, id, body.guide);
  return c.json({ id }, 201);
});

exerciseRoutes.patch("/exercises/:id", async (c) => {
  const profileId = c.get("profileId");
  const exercise = await visibleExercise(c.env.DB, profileId, intParam(c, "id"));
  if (exercise.owner_profile_id !== profileId) fail(403, "forbidden");
  const body = await readBody(c, exercisePatchSchema);
  await c.env.DB.prepare("UPDATE exercises SET name = ?, measure = ?, role = ? WHERE id = ?")
    .bind(body.name ?? exercise.name, body.measure ?? exercise.measure, body.role ?? exercise.role, exercise.id)
    .run();
  return c.json({ ok: true });
});

exerciseRoutes.delete("/exercises/:id", async (c) => {
  const profileId = c.get("profileId");
  const exercise = await visibleExercise(c.env.DB, profileId, intParam(c, "id"));
  if (exercise.owner_profile_id !== profileId) fail(403, "forbidden");
  await c.env.DB.prepare("DELETE FROM exercises WHERE id = ?").bind(exercise.id).run();
  return c.json({ ok: true });
});

// Editar una guia crea o actualiza la copia propia del perfil; la guia base no se toca.
exerciseRoutes.put("/exercises/:id/guide", async (c) => {
  const profileId = c.get("profileId");
  const exercise = await visibleExercise(c.env.DB, profileId, intParam(c, "id"));
  await writeGuide(c.env.DB, profileId, exercise.id, await readBody(c, guideSchema));
  return c.json({ ok: true });
});
