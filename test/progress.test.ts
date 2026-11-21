import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call, json, loginAs, noon, send, setupProfiles, trainToday } from "./helpers.ts";

const MON = "2026-11-02";
const TUE = "2026-11-03";
const WED = "2026-11-04";

let ana: string;
let luis: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(noon(MON));
  await setupProfiles("all");
  ana = await loginAs(1);
  luis = await loginAs(2);
});

afterEach(() => vi.useRealTimers());

const get = async (path: string, cookie: string) => json(await call(path, { cookie }));
const goTo = (date: string) => vi.setSystemTime(noon(date));

describe("progreso individual", () => {
  it("cuenta entrenamientos, sesiones por semana y cumplimiento", async () => {
    await trainToday(ana); // lunes
    goTo(TUE);
    await trainToday(ana);
    goTo(WED); // el miercoles aun no se entrena: hoy sigue abierto
    const data = await get("/api/progress", ana);
    expect(data.completedSessions).toBe(2);
    expect(data.compliance).toBe(100);
    const thisWeek = data.sessionsPerWeek.find((w: any) => w.weekStart === MON);
    expect(thisWeek.sessions).toBe(2);
    expect(data.sessionsPerWeek).toHaveLength(12);
  });

  it("el cumplimiento baja cuando se falta a un día programado", async () => {
    await trainToday(ana);
    goTo(WED); // martes quedo pendiente
    const data = await get("/api/progress", ana);
    expect(data.compliance).toBe(50);
  });

  it("sin días programados cerrados, el cumplimiento es nulo y no se rompe", async () => {
    const data = await get("/api/progress", luis);
    expect(data.completedSessions).toBe(0);
    expect(data.compliance).toBeNull();
    expect(data.sessionsPerWeek.every((w: any) => w.sessions === 0)).toBe(true);
  });

  it("el historial va del más reciente al más antiguo y se pagina", async () => {
    await trainToday(ana);
    goTo(TUE);
    await trainToday(ana);
    goTo(WED);
    await trainToday(ana);
    const first = await get("/api/progress/history?limit=2", ana);
    expect(first.sessions.map((s: any) => s.localDate)).toEqual([WED, TUE]);
    expect(first.nextBefore).not.toBeNull();
    const second = await get(`/api/progress/history?limit=2&before=${first.nextBefore}`, ana);
    expect(second.sessions.map((s: any) => s.localDate)).toEqual([MON]);
    expect(second.nextBefore).toBeNull();
    expect(first.sessions[0]).toMatchObject({ exercisesCompleted: 1, setsDone: 1 });
  });

  it("el progreso de una persona nunca incluye sesiones de la otra", async () => {
    await trainToday(ana);
    const mine = await get("/api/progress/history", luis);
    expect(mine.sessions).toEqual([]);
    expect((await get("/api/progress", luis)).completedSessions).toBe(0);
    expect((await get("/api/progress/exercises", luis)).exercises).toEqual([]);
  });

  it("la evolución de un ejercicio sale de las sesiones terminadas, por fecha", async () => {
    goTo(TUE);
    await trainToday(ana, [{ exercise: "Flexiones", value: 10, weightKg: null }, { exercise: "Remo con mochila", value: 12, weightKg: 8 }]);
    goTo("2026-11-10");
    await trainToday(ana, [{ exercise: "Flexiones", value: 11, weightKg: null }]);

    const list = (await get("/api/progress/exercises", ana)).exercises as { id: number; name: string }[];
    expect(list.map((e) => e.name).sort()).toEqual(["Flexiones", "Remo con mochila"]);

    const flexiones = list.find((e) => e.name === "Flexiones")!;
    const evolution = await get(`/api/progress/exercises/${flexiones.id}`, ana);
    expect(evolution.points.map((p: any) => [p.date, p.bestValue])).toEqual([[TUE, 10], ["2026-11-10", 11]]);
  });

  it("al cambiar el peso de una rutina o renombrar un ejercicio propio, el historial conserva lo registrado", async () => {
    const created = await json(await send("POST", "/api/exercises", ana, { name: "Burpees" }));
    const routine = (await get("/api/routines/active", ana)).routine;
    await send("POST", `/api/routines/${routine.id}/days/1/exercises`, ana, { exerciseId: created.id, sets: 1 });
    await trainToday(ana, [{ exercise: "Burpees", value: 7, weightKg: 4 }]);
    await send("PATCH", `/api/exercises/${created.id}`, ana, { name: "Burpee completo" });
    const evolution = await get(`/api/progress/exercises/${created.id}`, ana);
    expect(evolution.name).toBe("Burpees");
    expect(evolution.points[0]).toMatchObject({ bestWeightKg: 4, bestValue: 7, name: "Burpees" });
  });

  it("un ejercicio sin registros devuelve 404", async () => {
    expect((await call("/api/progress/exercises/1", { cookie: ana })).status).toBe(404);
  });

  it("el detalle de cada sesión realizada sale de la copia guardada", async () => {
    const { id } = await trainToday(ana);
    const detail = await get(`/api/sessions/${id}`, ana);
    expect(detail.summary).toMatchObject({ setsDone: 1, totalReps: 12 });
    expect(detail.session.exercises.filter((e: any) => e.kind === "exercise")).toHaveLength(5);
  });

  it("pide iniciar sesión", async () => {
    expect((await call("/api/progress")).status).toBe(401);
  });
});
