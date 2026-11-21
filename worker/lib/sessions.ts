import { effectiveGuides, type Guide } from "./routines.ts";

interface SessionRow {
  id: string;
  profile_id: number;
  local_date: string;
  routine_name: string;
  day_title: string;
  status: "in_progress" | "paused" | "completed";
  started_at: number;
  ended_at: number | null;
  duration_seconds: number | null;
  position: string | null;
}
interface ExerciseRow {
  id: number;
  position: number;
  kind: "warmup" | "exercise";
  exercise_id: number | null;
  name: string;
  detail: string;
  measure: string;
  role: string;
  sets_planned: number | null;
  target_min: number | null;
  target_max: number | null;
  weight_planned: number | null;
  rest_seconds: number | null;
  done: number;
}
interface SetRow {
  session_exercise_id: number;
  kind: "work" | "light";
  set_number: number;
  value: number | null;
  weight_kg: number | null;
}

export interface SessionDetail {
  id: string;
  status: SessionRow["status"];
  localDate: string;
  routineName: string;
  dayTitle: string;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number | null;
  position: string | null;
  exercises: {
    id: number;
    position: number;
    kind: "warmup" | "exercise";
    exerciseId: number | null;
    name: string;
    detail: string;
    measure: string;
    role: string;
    setsPlanned: number | null;
    targetMin: number | null;
    targetMax: number | null;
    weightPlanned: number | null;
    restSeconds: number | null;
    done: boolean;
    sets: { kind: "work" | "light"; setNumber: number; value: number | null; weightKg: number | null }[];
  }[];
  guides: Record<number, Guide>;
}

/** La sesion del perfil con sus ejercicios, series y guias, o null si no existe o es de otro perfil. */
export async function loadSession(db: D1Database, profileId: number, sessionId: string): Promise<SessionDetail | null> {
  const [sessionRes, exercisesRes, setsRes] = await db.batch([
    db
      .prepare(
        "SELECT id, profile_id, local_date, routine_name, day_title, status, started_at, ended_at, duration_seconds, position FROM sessions WHERE id = ? AND profile_id = ?",
      )
      .bind(sessionId, profileId),
    db
      .prepare(
        `SELECT id, position, kind, exercise_id, name, detail, measure, role, sets_planned, target_min, target_max,
                weight_planned, rest_seconds, done
         FROM session_exercises WHERE session_id = ? ORDER BY position`,
      )
      .bind(sessionId),
    db
      .prepare(
        `SELECT ss.session_exercise_id, ss.kind, ss.set_number, ss.value, ss.weight_kg
         FROM session_sets ss JOIN session_exercises se ON se.id = ss.session_exercise_id
         WHERE se.session_id = ? ORDER BY ss.session_exercise_id, ss.kind, ss.set_number`,
      )
      .bind(sessionId),
  ]);
  const session = sessionRes!.results[0] as unknown as SessionRow | undefined;
  if (!session) return null;
  const exercises = exercisesRes!.results as unknown as ExerciseRow[];
  const sets = setsRes!.results as unknown as SetRow[];
  const guides = await effectiveGuides(
    db,
    profileId,
    exercises.flatMap((e) => (e.exercise_id === null ? [] : [e.exercise_id])),
  );

  return {
    id: session.id,
    status: session.status,
    localDate: session.local_date,
    routineName: session.routine_name,
    dayTitle: session.day_title,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationSeconds: session.duration_seconds,
    position: session.position,
    exercises: exercises.map((e) => ({
      id: e.id,
      position: e.position,
      kind: e.kind,
      exerciseId: e.exercise_id,
      name: e.name,
      detail: e.detail,
      measure: e.measure,
      role: e.role,
      setsPlanned: e.sets_planned,
      targetMin: e.target_min,
      targetMax: e.target_max,
      weightPlanned: e.weight_planned,
      restSeconds: e.rest_seconds,
      done: e.done === 1,
      sets: sets
        .filter((s) => s.session_exercise_id === e.id)
        .map((s) => ({ kind: s.kind, setNumber: s.set_number, value: s.value, weightKg: s.weight_kg })),
    })),
    guides,
  };
}

const REP_MEASURES = new Set(["reps", "reps_side"]);

/** Resumen de una sesion terminada: ejercicios completados, series, repeticiones y duracion. */
export function summarize(session: SessionDetail) {
  const real = session.exercises.filter((e) => e.kind === "exercise");
  const workSets = real.flatMap((e) => e.sets.filter((s) => s.kind === "work").map((s) => ({ s, measure: e.measure })));
  return {
    exercisesCompleted: real.filter((e) => e.done).length,
    exercisesPlanned: real.length,
    setsDone: workSets.length,
    totalReps: workSets.reduce((sum, { s, measure }) => sum + (REP_MEASURES.has(measure) ? (s.value ?? 0) : 0), 0),
    durationSeconds: session.durationSeconds,
  };
}
