import { describe, expect, it } from "vitest";
import type { SessionExercise } from "../../lib/types.ts";
import { advance, extendRest, pauseRest, remainingMs, resumePosition, resumeRest } from "./progress.ts";

const ex = (over: Partial<SessionExercise>): SessionExercise => ({
  id: 1, position: 0, kind: "exercise", exerciseId: 1, name: "X", detail: "", measure: "reps", role: "main",
  setsPlanned: 3, targetMin: 10, targetMax: 12, weightPlanned: null, restSeconds: 90, done: false, sets: [], ...over,
});

describe("recorrido guiado", () => {
  it("retoma en la primera serie sin registrar del primer ejercicio sin terminar", () => {
    const list = [
      ex({ id: 1, done: true }),
      ex({ id: 2, sets: [{ kind: "work", setNumber: 1, value: 10, weightKg: null }, { kind: "work", setNumber: 2, value: 10, weightKg: null }] }),
    ];
    expect(resumePosition(list)).toEqual({ exercise: 1, set: 3 });
  });

  it("devuelve null cuando todo está terminado", () => {
    expect(resumePosition([ex({ done: true })])).toBeNull();
  });

  it("avanza de serie, de ejercicio y al final", () => {
    const list = [ex({ setsPlanned: 2 }), ex({ id: 2, setsPlanned: 1 })];
    expect(advance(list, { exercise: 0, set: 1 })).toEqual({ next: { exercise: 0, set: 2 }, exerciseDone: false });
    expect(advance(list, { exercise: 0, set: 2 })).toEqual({ next: { exercise: 1, set: 1 }, exerciseDone: true });
    expect(advance(list, { exercise: 1, set: 1 })).toEqual({ next: null, exerciseDone: true });
  });
});

describe("temporizador de descanso", () => {
  it("se calcula con la hora absoluta, no contando ticks", () => {
    const rest = { until: 100_000, pausedLeft: null };
    expect(remainingMs(rest, 40_000)).toBe(60_000);
    expect(remainingMs(rest, 99_999_999)).toBe(0); // llegar a cero no es una serie registrada
  });

  it("pausar congela el tiempo y seguir lo reanuda", () => {
    const paused = pauseRest({ until: 100_000, pausedLeft: null }, 70_000);
    expect(remainingMs(paused, 500_000)).toBe(30_000);
    expect(resumeRest(paused, 500_000)).toEqual({ until: 530_000, pausedLeft: null });
  });

  it("+15 s suma tiempo en marcha o en pausa", () => {
    expect(extendRest({ until: 100_000, pausedLeft: null }, 15).until).toBe(115_000);
    expect(extendRest({ until: 0, pausedLeft: 5_000 }, 15).pausedLeft).toBe(20_000);
  });
});
