import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { call, json, loginAs, noon, send, setupProfiles } from "./helpers.ts";

// Semana del lunes 2026-11-02 al domingo 2026-11-08.
const MON = "2026-11-02";
const TUE = "2026-11-03";
const WED = "2026-11-04";
const THU = "2026-11-05";
const FRI = "2026-11-06";
const SAT = "2026-11-07";
const NEXT_MON = "2026-11-09";

let ana: string;
let luis: string;
let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

function goTo(date: string) {
  vi.setSystemTime(noon(date));
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  goTo(MON);
  await setupProfiles("all");
  ana = await loginAs(1);
  luis = await loginAs(2);
});

afterEach(() => {
  vi.useRealTimers();
});

async function start(cookie: string, id = newId()) {
  const res = await send("POST", "/api/sessions/start", cookie, { id });
  return { res, id, body: await json(res) };
}

/** Empieza, registra una serie en el primer ejercicio y termina. */
async function trainToday(cookie: string) {
  const { id, body } = await start(cookie);
  const first = body.session.exercises.find((e: any) => e.kind === "exercise");
  await send("PUT", `/api/sessions/${id}/sets`, cookie, { sessionExerciseId: first.id, setNumber: 1, value: 12, weightKg: 10 });
  await send("PUT", `/api/sessions/${id}/exercises/${first.id}/done`, cookie, { done: true });
  const res = await send("POST", `/api/sessions/${id}/finish`, cookie, {});
  return { id, res, body: await json(res) };
}

const streakOf = async (cookie: string) => (await json(await call("/api/home", { cookie }))).streak as number;

describe("empezar una sesión", () => {
  it("copia lo planeado del día: calentamiento primero y luego los ejercicios en orden", async () => {
    const { res, body } = await start(ana);
    expect(res.status).toBe(201);
    const names = body.session.exercises.map((e: any) => `${e.kind}:${e.name}`);
    expect(names.slice(0, 6).every((n: string) => n.startsWith("warmup:"))).toBe(true);
    expect(names[6]).toBe("exercise:Sentadilla profunda con mochila");
    expect(names).toHaveLength(6 + 5);
    expect(body.session.dayTitle).toBe("Glúteos y piernas (glúteos y cuádriceps)");
    const squat = body.session.exercises[6];
    expect(squat).toMatchObject({ setsPlanned: 3, targetMin: 12, targetMax: 15, restSeconds: 120, role: "main" });
  });

  it("la persona 2 no trae calentamiento", async () => {
    const { body } = await start(luis);
    expect(body.session.exercises.every((e: any) => e.kind === "exercise")).toBe(true);
    expect(body.session.exercises[0].name).toBe("Curl de bíceps");
  });

  it("repetir la llamada con el mismo id no duplica la sesión ni sus ejercicios", async () => {
    const id = newId();
    await start(ana, id);
    const again = await start(ana, id);
    expect(again.res.status).toBe(200);
    expect(again.body.session.exercises).toHaveLength(11);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM session_exercises").first<{ n: number }>();
    expect(count!.n).toBe(11);
  });

  it("no se puede empezar otra sesión mientras hay una abierta", async () => {
    const first = await start(ana);
    const second = await start(ana);
    expect(second.res.status).toBe(409);
    expect(second.body).toEqual({ error: "session_open", id: first.id });
  });

  it("un día de descanso sin ejercicios no se puede empezar", async () => {
    goTo(SAT);
    const { res, body } = await start(ana);
    expect(res.status).toBe(409);
    expect(body.error).toBe("no_exercises_today");
  });

  it("empezar sin terminar no cuenta como completada ni cambia la racha", async () => {
    await start(ana);
    expect(await streakOf(ana)).toBe(0);
    const home = await json(await call("/api/home", { cookie: ana }));
    expect(home.today.state).toBe("pending");
    expect(home.sessionsThisWeek).toBe(0);
    expect(home.openSession.status).toBe("in_progress");
  });

  it("una persona no puede usar la sesión de la otra", async () => {
    const { id, body } = await start(ana);
    const exerciseId = body.session.exercises[6].id;
    expect((await call(`/api/sessions/${id}`, { cookie: luis })).status).toBe(404);
    expect((await send("PUT", `/api/sessions/${id}/sets`, luis, { sessionExerciseId: exerciseId, setNumber: 1, value: 5 })).status).toBe(404);
    expect((await send("POST", `/api/sessions/${id}/finish`, luis, {})).status).toBe(404);
    expect((await send("POST", "/api/sessions/start", luis, { id })).status).toBe(404);
  });
});

describe("registrar series", () => {
  it("la serie solo existe cuando se registra; el descanso no registra nada", async () => {
    const { id, body } = await start(ana);
    const squat = body.session.exercises[6];
    expect(squat.sets).toEqual([]);
    const reloaded = await json(await call(`/api/sessions/${id}`, { cookie: ana }));
    expect(reloaded.session.exercises[6].sets).toEqual([]);
    expect(reloaded.session.exercises[6].done).toBe(false);
  });

  it("reenviar la misma serie deja una sola fila y reenviarla con otros valores la corrige", async () => {
    const { id, body } = await start(ana);
    const squat = body.session.exercises[6];
    const put = (value: number, weightKg: number) =>
      send("PUT", `/api/sessions/${id}/sets`, ana, { sessionExerciseId: squat.id, setNumber: 1, value, weightKg });
    await put(12, 10);
    await put(12, 10);
    await put(14, 12.5);
    const after = await json(await call(`/api/sessions/${id}`, { cookie: ana }));
    expect(after.session.exercises[6].sets).toEqual([{ kind: "work", setNumber: 1, value: 14, weightKg: 12.5 }]);
  });

  it("la serie ligera tras el calentamiento se guarda aparte de las series de trabajo", async () => {
    const { id, body } = await start(ana);
    const squat = body.session.exercises[6];
    await send("PUT", `/api/sessions/${id}/sets`, ana, { sessionExerciseId: squat.id, kind: "light", setNumber: 1, value: 10, weightKg: 5 });
    await send("PUT", `/api/sessions/${id}/sets`, ana, { sessionExerciseId: squat.id, setNumber: 1, value: 12, weightKg: 10 });
    const after = await json(await call(`/api/sessions/${id}`, { cookie: ana }));
    expect(after.session.exercises[6].sets.map((s: any) => s.kind).sort()).toEqual(["light", "work"]);
  });

  it("completar una serie no completa el ejercicio", async () => {
    const { id, body } = await start(ana);
    const squat = body.session.exercises[6];
    for (const n of [1, 2, 3]) {
      await send("PUT", `/api/sessions/${id}/sets`, ana, { sessionExerciseId: squat.id, setNumber: n, value: 12, weightKg: 10 });
    }
    expect((await json(await call(`/api/sessions/${id}`, { cookie: ana }))).session.exercises[6].done).toBe(false);
    await send("PUT", `/api/sessions/${id}/exercises/${squat.id}/done`, ana, { done: true });
    expect((await json(await call(`/api/sessions/${id}`, { cookie: ana }))).session.exercises[6].done).toBe(true);
  });

  it("rechaza una serie de un ejercicio que no es de esa sesión", async () => {
    const { id } = await start(ana);
    expect((await send("PUT", `/api/sessions/${id}/sets`, ana, { sessionExerciseId: 999999, setNumber: 1, value: 5 })).status).toBe(404);
  });
});

describe("pausar y retomar", () => {
  it("una sesión pausada con dos series se retoma en el mismo punto con las series intactas", async () => {
    const { id, body } = await start(ana);
    const squat = body.session.exercises[6];
    for (const n of [1, 2]) {
      await send("PUT", `/api/sessions/${id}/sets`, ana, { sessionExerciseId: squat.id, setNumber: n, value: 12, weightKg: 10 });
    }
    await send("PATCH", `/api/sessions/${id}`, ana, { status: "paused", position: JSON.stringify({ exercise: 6, set: 3 }) });

    const current = await json(await call("/api/sessions/current", { cookie: ana }));
    expect(current.session.id).toBe(id);
    expect(current.session.status).toBe("paused");
    expect(JSON.parse(current.session.position)).toEqual({ exercise: 6, set: 3 });
    expect(current.session.exercises[6].sets).toHaveLength(2);

    await send("PATCH", `/api/sessions/${id}`, ana, { status: "in_progress" });
    expect((await json(await call("/api/sessions/current", { cookie: ana }))).session.status).toBe("in_progress");
    expect((await json(await call("/api/home", { cookie: ana }))).openSession).toEqual({ id, status: "in_progress" });
  });

  it("sin sesión abierta, current devuelve null", async () => {
    expect((await json(await call("/api/sessions/current", { cookie: ana }))).session).toBeNull();
  });
});

describe("terminar", () => {
  it("devuelve el resumen y deja el día completado", async () => {
    const { body } = await trainToday(ana);
    expect(body.summary).toMatchObject({ exercisesCompleted: 1, exercisesPlanned: 5, setsDone: 1, totalReps: 12 });
    expect(body.session.status).toBe("completed");
    const home = await json(await call("/api/home", { cookie: ana }));
    expect(home.today.state).toBe("completed");
    expect(home.streak).toBe(1);
    expect(home.sessionsThisWeek).toBe(1);
    expect(home.openSession).toBeNull();
  });

  it("terminar dos veces la misma sesión no duplica el día ni cambia la racha", async () => {
    const { id } = await trainToday(ana);
    const again = await send("POST", `/api/sessions/${id}/finish`, ana, {});
    expect(again.status).toBe(200);
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM day_log WHERE profile_id = 1").first<{ n: number }>();
    expect(rows!.n).toBe(1);
    expect(await streakOf(ana)).toBe(1);
  });

  it("no se puede registrar nada en una sesión ya terminada", async () => {
    const { id, body } = await start(ana);
    const squat = body.session.exercises[6];
    await send("POST", `/api/sessions/${id}/finish`, ana, {});
    const res = await send("PUT", `/api/sessions/${id}/sets`, ana, { sessionExerciseId: squat.id, setNumber: 1, value: 5 });
    expect(res.status).toBe(409);
  });

  it("covers AE1: borrar un ejercicio de la rutina no altera la sesión ya terminada", async () => {
    const { id } = await trainToday(ana);
    const routine = (await json(await call("/api/routines/active", { cookie: ana }))).routine;
    const bulgara = routine.days[0].exercises.find((e: any) => e.name === "Sentadilla búlgara");
    expect((await send("DELETE", `/api/routines/${routine.id}/days/1/exercises/${bulgara.id}`, ana)).status).toBe(200);
    goTo(TUE);
    const session = (await json(await call(`/api/sessions/${id}`, { cookie: ana }))).session;
    const names = session.exercises.map((e: any) => e.name);
    expect(names).toContain("Sentadilla búlgara");
    expect(session.exercises.find((e: any) => e.name === "Sentadilla profunda con mochila").sets[0]).toMatchObject({ value: 12, weightKg: 10 });
  });
});

describe("rachas", () => {
  async function bothTrain() {
    await trainToday(ana);
    await trainToday(luis);
  }

  it("covers AE3: faltar un día programado corta solo la racha de esa persona", async () => {
    await bothTrain(); // lunes
    goTo(TUE);
    await bothTrain();
    goTo(WED);
    await bothTrain();
    goTo(THU);
    await trainToday(ana); // luis falta
    goTo(FRI);
    expect(await streakOf(ana)).toBe(4);
    expect(await streakOf(luis)).toBe(0);
    await trainToday(luis);
    expect(await streakOf(luis)).toBe(1);
    expect(await streakOf(ana)).toBe(4);
  });

  it("covers AE4: el fin de semana de descanso no rompe la racha y no queda como pendiente", async () => {
    goTo(FRI);
    await trainToday(ana);
    goTo(NEXT_MON);
    await trainToday(ana);
    expect(await streakOf(ana)).toBe(2);
    const { results } = await env.DB.prepare("SELECT date, status FROM day_log WHERE profile_id = 1 AND date IN (?, ?)")
      .bind("2026-11-07", "2026-11-08")
      .all<{ date: string; status: string }>();
    expect(results.map((r) => r.status)).toEqual(["rest", "rest"]);
  });

  it("un día programado sin sesión queda pendiente y uno de descanso queda descanso", async () => {
    goTo(NEXT_MON);
    const home = await json(await call("/api/home", { cookie: ana }));
    const { results } = await env.DB.prepare("SELECT date, status FROM day_log WHERE profile_id = 1 ORDER BY date").all<{ date: string; status: string }>();
    expect(home.streak).toBe(0);
    // la rutina se creo el lunes 2: de lunes a viernes quedan pendientes, sabado y domingo en descanso
    expect(results.map((r) => r.status)).toEqual(["pending", "pending", "pending", "pending", "pending", "rest", "rest"]);
  });

  it("una sesión extra en un día de descanso se guarda pero no suma a la racha", async () => {
    goTo(FRI);
    await trainToday(ana);
    // el sabado se programa una sesion extra
    const routine = (await json(await call("/api/routines/active", { cookie: ana }))).routine;
    const curl = routine.days[1].exercises[2].exerciseId;
    await send("POST", `/api/routines/${routine.id}/days/6/exercises`, ana, { exerciseId: curl, sets: 2 });
    goTo(SAT);
    const { id } = await trainToday(ana);
    const session = (await json(await call(`/api/sessions/${id}`, { cookie: ana }))).session;
    expect(session.status).toBe("completed");
    expect(await streakOf(ana)).toBe(1);
    const home = await json(await call("/api/home", { cookie: ana }));
    expect(home.today.state).toBe("completed");
  });
});

describe("inicio", () => {
  it("muestra los siete días con su estado, el de hoy y lo programado", async () => {
    await trainToday(ana);
    goTo(WED);
    const home = await json(await call("/api/home", { cookie: ana }));
    expect(home.week.map((d: any) => d.date)).toEqual([MON, TUE, WED, THU, FRI, SAT, "2026-11-08"]);
    expect(home.week[0]).toMatchObject({ status: "completed", kind: "session" });
    expect(home.week[1]).toMatchObject({ status: "pending", kind: "session" });
    expect(home.week[2]).toMatchObject({ status: "pending" }); // hoy, aun abierto
    expect(home.week[3].status).toBeNull();
    expect(home.week[5]).toMatchObject({ status: null, kind: "rest" });
    expect(home.today).toMatchObject({ kind: "session", title: "Recuperación activa", state: "pending" });
  });

  it("el sábado muestra el descanso programado", async () => {
    goTo(SAT);
    const home = await json(await call("/api/home", { cookie: ana }));
    expect(home.today).toMatchObject({ kind: "rest", state: "rest", exerciseCount: 0 });
  });

  it("sin rutina activa, hoy es descanso", async () => {
    const routine = (await json(await call("/api/routines/active", { cookie: ana }))).routine;
    await send("DELETE", `/api/routines/${routine.id}`, ana);
    const home = await json(await call("/api/home", { cookie: ana }));
    expect(home.routine).toBeNull();
    expect(home.today.state).toBe("rest");
  });
});
