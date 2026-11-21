// Genera las sentencias SQL (una por elemento, sin parametros) que cargan los datos iniciales.
// Es repetible: cada fila tiene un id fijo y se inserta con "OR IGNORE".
import { addDays, localDate } from "../shared/dates.ts";
import { exercises } from "./exercises.ts";
import { routines } from "./routines.ts";

export function lit(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

export interface SeedOptions {
  names: [string, string];
  /** instante de referencia en ms; por defecto, ahora */
  nowMs?: number;
  /** "profiles" carga solo los dos perfiles (para pruebas); por defecto, todo */
  scope?: "profiles" | "all";
}

export function buildSeed(options: SeedOptions): string[] {
  const nowMs = options.nowMs ?? Date.now();
  const statements: string[] = [];

  options.names.forEach((name, index) => {
    const id = index + 1;
    statements.push(`INSERT OR IGNORE INTO profiles (id, name) VALUES (${id}, ${lit(name)})`);
    statements.push(`INSERT OR IGNORE INTO login_lock (profile_id) VALUES (${id})`);
  });

  if (options.scope === "profiles") return statements;

  const exerciseId = new Map<string, number>();
  exercises.forEach((ex, index) => {
    const id = index + 1;
    exerciseId.set(ex.slug, id);
    statements.push(
      `INSERT OR IGNORE INTO exercises (id, slug, name, measure, role, created_at) VALUES (${id}, ${lit(ex.slug)}, ${lit(ex.name)}, ${lit(ex.measure)}, ${lit(ex.role)}, ${nowMs})`,
    );
    statements.push(
      `INSERT OR IGNORE INTO guides (id, exercise_id, muscles, materials, steps, tips, mistakes) VALUES (${id}, ${id}, ${lit(ex.muscles)}, ${lit(ex.materials)}, ${lit(JSON.stringify(ex.steps))}, ${lit(ex.tips)}, ${lit(ex.mistakes)})`,
    );
  });

  for (const routine of routines) {
    const until = routine.reducedVolumeDays ? addDays(localDate(nowMs), routine.reducedVolumeDays) : null;
    statements.push(
      `INSERT OR IGNORE INTO routines (id, profile_id, name, description, is_active, reduced_volume_until, created_at) VALUES (${routine.id}, ${routine.profileId}, ${lit(routine.name)}, ${lit(routine.description)}, 1, ${lit(until)}, ${nowMs})`,
    );
    routine.warmup.forEach((item, i) => {
      statements.push(
        `INSERT OR IGNORE INTO routine_warmup_items (id, routine_id, position, name, detail) VALUES (${routine.id * 100 + i + 1}, ${routine.id}, ${i + 1}, ${lit(item.name)}, ${lit(item.detail)})`,
      );
    });
    for (const day of routine.days) {
      const dayId = routine.id * 100 + day.weekday;
      statements.push(
        `INSERT OR IGNORE INTO routine_days (id, routine_id, weekday, kind, title, warmup_enabled) VALUES (${dayId}, ${routine.id}, ${day.weekday}, ${lit(day.kind)}, ${lit(day.title)}, ${day.warmup && routine.warmup.length > 0 ? 1 : 0})`,
      );
      day.exercises.forEach((p, i) => {
        const id = exerciseId.get(p.slug);
        if (id === undefined) throw new Error(`Ejercicio desconocido en la rutina inicial: ${p.slug}`);
        statements.push(
          `INSERT OR IGNORE INTO routine_day_exercises (id, routine_day_id, exercise_id, position, sets, target_min, target_max, weight_kg, rest_seconds, role) VALUES (${dayId * 100 + i + 1}, ${dayId}, ${id}, ${i + 1}, ${lit(p.sets)}, ${lit(p.min)}, ${lit(p.max)}, NULL, ${lit(p.rest)}, ${lit(p.role)})`,
        );
      });
    }
  }

  return statements;
}
