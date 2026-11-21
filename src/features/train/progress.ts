import type { SessionExercise } from "../../lib/types.ts";

// Estado del recorrido guiado: posición actual y descanso. Es puro para poder probarlo.
export interface Position {
  exercise: number; // índice en session.exercises
  set: number; // número de serie actual, desde 1
}

export interface Rest {
  until: number; // instante absoluto (ms): el temporizador se calcula con la hora, no contando ticks
  pausedLeft: number | null; // ms restantes si está en pausa
}

export function setsFor(exercise: SessionExercise): number {
  return exercise.kind === "warmup" ? 1 : Math.max(1, exercise.setsPlanned ?? 1);
}

/** Primer ejercicio sin terminar, con su primera serie no registrada. */
export function resumePosition(exercises: SessionExercise[]): Position | null {
  const index = exercises.findIndex((e) => !e.done);
  if (index === -1) return null;
  const done = new Set(exercises[index]!.sets.filter((s) => s.kind === "work").map((s) => s.setNumber));
  let set = 1;
  while (done.has(set) && set < setsFor(exercises[index]!)) set++;
  return { exercise: index, set };
}

export function remainingMs(rest: Rest, now: number): number {
  return Math.max(0, rest.pausedLeft ?? rest.until - now);
}

export function pauseRest(rest: Rest, now: number): Rest {
  return rest.pausedLeft === null ? { until: rest.until, pausedLeft: Math.max(0, rest.until - now) } : rest;
}

export function resumeRest(rest: Rest, now: number): Rest {
  return rest.pausedLeft === null ? rest : { until: now + rest.pausedLeft, pausedLeft: null };
}

export function extendRest(rest: Rest, seconds: number): Rest {
  return rest.pausedLeft === null
    ? { until: rest.until + seconds * 1000, pausedLeft: null }
    : { until: rest.until, pausedLeft: rest.pausedLeft + seconds * 1000 };
}

/** Avance tras terminar una serie: siguiente serie, siguiente ejercicio o fin (null). */
export function advance(exercises: SessionExercise[], position: Position): { next: Position | null; exerciseDone: boolean } {
  const current = exercises[position.exercise]!;
  if (position.set < setsFor(current)) return { next: { exercise: position.exercise, set: position.set + 1 }, exerciseDone: false };
  const nextIndex = position.exercise + 1;
  return { next: nextIndex < exercises.length ? { exercise: nextIndex, set: 1 } : null, exerciseDone: true };
}
