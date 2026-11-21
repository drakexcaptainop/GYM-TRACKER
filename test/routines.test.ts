import { beforeEach, describe, expect, it } from "vitest";
import { call, loginAs, post, setupProfiles } from "./helpers.ts";

type Day = { weekday: number; kind: string; title: string; warmupEnabled: boolean; exercises: Item[] };
type Item = {
  id: number;
  exerciseId: number;
  name: string;
  measure: string;
  position: number;
  sets: number | null;
  targetMin: number | null;
  targetMax: number | null;
  weightKg: number | null;
  restSeconds: number | null;
  role: string;
};
type Routine = {
  id: number;
  name: string;
  isActive: boolean;
  reducedVolumeUntil: string | null;
  warmup: { name: string }[];
  days: Day[];
  guides: Record<string, { steps: string[]; muscles: string }>;
};

let ana: string;
let luis: string;

beforeEach(async () => {
  await setupProfiles("all");
  ana = await loginAs(1);
  luis = await loginAs(2);
});

const json = async (res: Response) => (await res.json()) as any;
const activeRoutine = async (cookie: string) => (await json(await call("/api/routines/active", { cookie }))).routine as Routine;
const send = (method: string, path: string, cookie: string, body?: unknown) =>
  call(path, { method, cookie, body: body === undefined ? undefined : JSON.stringify(body) });

describe("rutinas iniciales", () => {
  it("la persona 1 tiene sesiones lunes a viernes, miércoles como recuperación activa y fin de semana en descanso", async () => {
    const routine = await activeRoutine(ana);
    const kinds = routine.days.map((d) => d.kind);
    expect(kinds).toEqual(["session", "session", "session", "session", "session", "rest", "rest"]);
    expect(routine.days[2]!.title).toBe("Recuperación activa");
    expect(routine.days[2]!.exercises.map((e) => e.name)).toContain("Caminata");
    expect(routine.days[0]!.exercises.map((e) => e.name)).toEqual([
      "Sentadilla profunda con mochila",
      "Hip thrust con mochila",
      "Sentadilla búlgara",
      "Elevación de talones de pie",
      "Abducción de cadera acostada de lado",
    ]);
  });

  it("el calentamiento de la persona 1 va en lunes, martes, jueves y viernes, no el miércoles", async () => {
    const routine = await activeRoutine(ana);
    expect(routine.warmup).toHaveLength(6);
    expect(routine.days.filter((d) => d.warmupEnabled).map((d) => d.weekday)).toEqual([1, 2, 4, 5]);
  });

  it("solo la persona 1 trae la indicación de volumen reducido de dos semanas", async () => {
    expect((await activeRoutine(ana)).reducedVolumeUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await activeRoutine(luis)).reducedVolumeUntil).toBeNull();
  });

  it("los descansos iniciales siguen los rangos de cada persona", async () => {
    const a = (await activeRoutine(ana)).days[0]!.exercises;
    expect(a[0]!.restSeconds).toBe(120); // principal 90-150
    expect(a[3]!.restSeconds).toBe(60); // accesorio 45-90
    const l = (await activeRoutine(luis)).days[0]!.exercises;
    expect(l[0]!.restSeconds).toBe(75); // principal 60-90
    expect(l[3]!.restSeconds).toBe(50); // accesorio 45-60
  });

  it("un ejercicio sin series y medido en minutos se guarda sin series", async () => {
    const walk = (await activeRoutine(ana)).days[2]!.exercises[0]!;
    expect(walk.measure).toBe("minutes");
    expect(walk.sets).toBeNull();
    expect([walk.targetMin, walk.targetMax]).toEqual([20, 30]);
  });

  it("todos los ejercicios de las dos rutinas llegan con guía completa", async () => {
    for (const cookie of [ana, luis]) {
      const routine = await activeRoutine(cookie);
      const ids = new Set(routine.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
      expect(ids.size).toBeGreaterThan(10);
      for (const id of ids) {
        const guide = routine.guides[String(id)];
        expect(guide, `ejercicio ${id}`).toBeDefined();
        expect(guide!.steps.length).toBeGreaterThanOrEqual(3);
        expect(guide!.muscles.length).toBeGreaterThan(0);
      }
    }
  });

  it("un ejercicio presente en las dos rutinas tiene prescripciones distintas y la misma guía base", async () => {
    const a = await activeRoutine(ana);
    const l = await activeRoutine(luis);
    const find = (r: Routine, weekday: number, name: string) => r.days[weekday - 1]!.exercises.find((e) => e.name === name)!;
    const remoA = find(a, 5, "Remo con mochila");
    const remoL = find(l, 4, "Remo con mochila");
    expect(remoA.exerciseId).toBe(remoL.exerciseId);
    expect(remoA.sets).not.toBe(remoL.sets);
    expect(a.guides[String(remoA.exerciseId)]).toEqual(l.guides[String(remoL.exerciseId)]);
  });
});

describe("administración de rutinas", () => {
  it("duplicar crea una copia independiente: editarla no cambia la original", async () => {
    const original = await activeRoutine(ana);
    const dup = await json(await send("POST", `/api/routines/${original.id}/duplicate`, ana, {}));
    expect(dup.id).not.toBe(original.id);

    const copy = (await json(await call(`/api/routines/${dup.id}`, { cookie: ana }))).routine as Routine;
    expect(copy.isActive).toBe(false);
    expect(copy.days[0]!.exercises).toHaveLength(original.days[0]!.exercises.length);
    expect(copy.warmup).toHaveLength(6);

    const item = copy.days[0]!.exercises[0]!;
    await send("PATCH", `/api/routines/${dup.id}/days/1/exercises/${item.id}`, ana, { weightKg: 20, sets: 5 });
    const after = await activeRoutine(ana);
    expect(after.days[0]!.exercises[0]!.weightKg).toBeNull();
    expect(after.days[0]!.exercises[0]!.sets).toBe(3);
  });

  it("activar una rutina desactiva la anterior: nunca quedan dos activas", async () => {
    const first = await activeRoutine(ana);
    const created = await json(await send("POST", "/api/routines", ana, { name: "Otra" }));
    expect((await send("POST", `/api/routines/${created.id}/activate`, ana, {})).status).toBe(200);
    const list = (await json(await call("/api/routines", { cookie: ana }))).routines as { id: number; isActive: boolean }[];
    expect(list.filter((r) => r.isActive).map((r) => r.id)).toEqual([created.id]);
    expect(list.find((r) => r.id === first.id)!.isActive).toBe(false);
  });

  it("una rutina nueva trae siete días de descanso y se puede editar su nombre y descripción", async () => {
    const created = await json(await send("POST", "/api/routines", ana, { name: "Nueva", description: "x" }));
    await send("PATCH", `/api/routines/${created.id}`, ana, { name: "Renombrada" });
    const routine = (await json(await call(`/api/routines/${created.id}`, { cookie: ana }))).routine as Routine;
    expect(routine.name).toBe("Renombrada");
    expect(routine.days.map((d) => d.kind)).toEqual(Array(7).fill("rest"));
  });

  it("un perfil no puede leer, editar, activar, duplicar ni borrar una rutina del otro", async () => {
    const others = await activeRoutine(luis);
    const id = others.id;
    expect((await call(`/api/routines/${id}`, { cookie: ana })).status).toBe(404);
    expect((await send("PATCH", `/api/routines/${id}`, ana, { name: "x" })).status).toBe(404);
    expect((await send("POST", `/api/routines/${id}/activate`, ana, {})).status).toBe(404);
    expect((await send("POST", `/api/routines/${id}/duplicate`, ana, {})).status).toBe(404);
    expect((await send("DELETE", `/api/routines/${id}`, ana)).status).toBe(404);
    expect((await send("PATCH", `/api/routines/${id}/days/1`, ana, { kind: "rest" })).status).toBe(404);
    expect((await activeRoutine(luis)).name).toBe(others.name);
  });

  it("convertir un día en descanso y de vuelta conserva sus ejercicios", async () => {
    const routine = await activeRoutine(ana);
    await send("PATCH", `/api/routines/${routine.id}/days/1`, ana, { kind: "rest" });
    expect((await activeRoutine(ana)).days[0]!.kind).toBe("rest");
    await send("PATCH", `/api/routines/${routine.id}/days/1`, ana, { kind: "session" });
    const back = (await activeRoutine(ana)).days[0]!;
    expect(back.kind).toBe("session");
    expect(back.exercises).toHaveLength(5);
  });

  it("agregar, editar, reordenar y quitar ejercicios de un día", async () => {
    const routine = await activeRoutine(ana);
    const day = routine.days[5]!; // sabado, descanso
    expect(day.exercises).toHaveLength(0);
    const flexiones = routine.days[1]!.exercises[0]!.exerciseId;
    const curl = routine.days[1]!.exercises[2]!.exerciseId;

    const a = await json(await send("POST", `/api/routines/${routine.id}/days/6/exercises`, ana, { exerciseId: flexiones, sets: 3, targetMin: 12, targetMax: 15 }));
    const b = await json(await send("POST", `/api/routines/${routine.id}/days/6/exercises`, ana, { exerciseId: curl, sets: 2 }));
    await send("PATCH", `/api/routines/${routine.id}/days/6/exercises/${a.id}`, ana, { weightKg: 12.5, restSeconds: 90 });
    await send("PUT", `/api/routines/${routine.id}/days/6/order`, ana, { itemIds: [b.id, a.id] });

    let saturday = (await activeRoutine(ana)).days[5]!;
    expect(saturday.exercises.map((e) => e.id)).toEqual([b.id, a.id]);
    expect(saturday.exercises[1]).toMatchObject({ weightKg: 12.5, restSeconds: 90, targetMin: 12, targetMax: 15 });

    await send("DELETE", `/api/routines/${routine.id}/days/6/exercises/${b.id}`, ana);
    saturday = (await activeRoutine(ana)).days[5]!;
    expect(saturday.exercises.map((e) => e.id)).toEqual([a.id]);
  });

  it("rechaza un orden que no contiene exactamente los ejercicios del día y un rango invertido", async () => {
    const routine = await activeRoutine(ana);
    const ids = routine.days[0]!.exercises.map((e) => e.id);
    expect((await send("PUT", `/api/routines/${routine.id}/days/1/order`, ana, { itemIds: ids.slice(1) })).status).toBe(400);
    const item = ids[0]!;
    expect((await send("PATCH", `/api/routines/${routine.id}/days/1/exercises/${item}`, ana, { targetMin: 20, targetMax: 10 })).status).toBe(400);
  });

  it("un rango como 12-15 se guarda como rango", async () => {
    const routine = await activeRoutine(ana);
    const item = routine.days[0]!.exercises[0]!;
    expect([item.targetMin, item.targetMax]).toEqual([12, 15]);
  });

  it("no deja agregar el ejercicio propio de otra persona a una rutina", async () => {
    const own = await json(await send("POST", "/api/exercises", luis, { name: "Mi ejercicio" }));
    const routine = await activeRoutine(ana);
    const res = await send("POST", `/api/routines/${routine.id}/days/6/exercises`, ana, { exerciseId: own.id });
    expect(res.status).toBe(404);
  });

  it("eliminar la rutina activa deja al perfil sin rutina activa", async () => {
    const routine = await activeRoutine(ana);
    await send("DELETE", `/api/routines/${routine.id}`, ana);
    expect((await json(await call("/api/routines/active", { cookie: ana }))).routine).toBeNull();
  });

  it("reemplaza el calentamiento de una rutina", async () => {
    const routine = await activeRoutine(ana);
    await send("PUT", `/api/routines/${routine.id}/warmup`, ana, { items: [{ name: "Trote suave", detail: "2 minutos" }] });
    expect((await activeRoutine(ana)).warmup).toEqual([expect.objectContaining({ name: "Trote suave" })]);
  });

  it("las rutas de rutinas piden iniciar sesión", async () => {
    expect((await post("/api/routines", { name: "x" })).status).toBe(401);
  });
});
