export interface Guide {
  muscles: string;
  materials: string;
  steps: string[];
  tips: string;
  mistakes: string;
}

interface GuideRow {
  exercise_id: number;
  profile_id: number | null;
  muscles: string;
  materials: string;
  steps: string;
  tips: string;
  mistakes: string;
}

function parseSteps(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function toGuide(row: GuideRow): Guide {
  return { muscles: row.muscles, materials: row.materials, steps: parseSteps(row.steps), tips: row.tips, mistakes: row.mistakes };
}

/** Guia efectiva por ejercicio: la copia propia del perfil si existe, si no la base. */
export async function effectiveGuides(db: D1Database, profileId: number, exerciseIds: number[]): Promise<Record<number, Guide>> {
  const ids = [...new Set(exerciseIds)];
  if (ids.length === 0) return {};
  const marks = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT exercise_id, profile_id, muscles, materials, steps, tips, mistakes FROM guides
       WHERE exercise_id IN (${marks}) AND (profile_id IS NULL OR profile_id = ?)`,
    )
    .bind(...ids, profileId)
    .all<GuideRow>();
  const out: Record<number, Guide> = {};
  for (const row of results.filter((r) => r.profile_id === null)) out[row.exercise_id] = toGuide(row);
  for (const row of results.filter((r) => r.profile_id !== null)) out[row.exercise_id] = toGuide(row);
  return out;
}

interface RoutineRow {
  id: number;
  name: string;
  description: string;
  is_active: number;
  reduced_volume_until: string | null;
}
interface DayRow {
  id: number;
  weekday: number;
  kind: "session" | "rest";
  title: string;
  warmup_enabled: number;
}
interface ItemRow {
  id: number;
  routine_day_id: number;
  exercise_id: number;
  position: number;
  sets: number | null;
  target_min: number | null;
  target_max: number | null;
  weight_kg: number | null;
  rest_seconds: number | null;
  role: "main" | "accessory";
  name: string;
  measure: string;
}
interface WarmupRow {
  id: number;
  position: number;
  name: string;
  detail: string;
}

/** Rutina completa (dias, ejercicios, calentamiento y guias) o null si no es del perfil. */
export async function loadRoutine(db: D1Database, profileId: number, routineId: number) {
  const [routineRes, daysRes, itemsRes, warmupRes] = await db.batch([
    db
      .prepare("SELECT id, name, description, is_active, reduced_volume_until FROM routines WHERE id = ? AND profile_id = ?")
      .bind(routineId, profileId),
    db.prepare("SELECT id, weekday, kind, title, warmup_enabled FROM routine_days WHERE routine_id = ? ORDER BY weekday").bind(routineId),
    db
      .prepare(
        `SELECT rde.id, rde.routine_day_id, rde.exercise_id, rde.position, rde.sets, rde.target_min, rde.target_max,
                rde.weight_kg, rde.rest_seconds, rde.role, e.name, e.measure
         FROM routine_day_exercises rde JOIN exercises e ON e.id = rde.exercise_id
         WHERE rde.routine_day_id IN (SELECT id FROM routine_days WHERE routine_id = ?)
         ORDER BY rde.routine_day_id, rde.position`,
      )
      .bind(routineId),
    db.prepare("SELECT id, position, name, detail FROM routine_warmup_items WHERE routine_id = ? ORDER BY position").bind(routineId),
  ]);
  const routine = routineRes!.results[0] as unknown as RoutineRow | undefined;
  if (!routine) return null;
  const items = itemsRes!.results as unknown as ItemRow[];
  const guides = await effectiveGuides(
    db,
    profileId,
    items.map((i) => i.exercise_id),
  );

  return {
    id: routine.id,
    name: routine.name,
    description: routine.description,
    isActive: routine.is_active === 1,
    reducedVolumeUntil: routine.reduced_volume_until,
    warmup: (warmupRes!.results as unknown as WarmupRow[]).map((w) => ({ id: w.id, name: w.name, detail: w.detail })),
    days: (daysRes!.results as unknown as DayRow[]).map((d) => ({
      id: d.id,
      weekday: d.weekday,
      kind: d.kind,
      title: d.title,
      warmupEnabled: d.warmup_enabled === 1,
      exercises: items
        .filter((i) => i.routine_day_id === d.id)
        .map((i) => ({
          id: i.id,
          exerciseId: i.exercise_id,
          name: i.name,
          measure: i.measure,
          position: i.position,
          sets: i.sets,
          targetMin: i.target_min,
          targetMax: i.target_max,
          weightKg: i.weight_kg,
          restSeconds: i.rest_seconds,
          role: i.role,
        })),
    })),
    guides,
  };
}
