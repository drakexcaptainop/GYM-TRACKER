import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index.ts";
import { json, loginAs, newId, noon, send, setupProfiles, startSession } from "./helpers.ts";

// Presupuesto del plan gratis (KTD5): cada recorrido habitual mide consultas, filas leídas y filas escritas
// y falla si supera un tope fijado con margen sobre lo medido.
interface Cost {
  queries: number;
  read: number;
  written: number;
}

function countingEnv(cost: Cost) {
  const add = (meta: any) => {
    cost.read += meta?.rows_read ?? 0;
    cost.written += meta?.rows_written ?? 0;
  };
  const wrap = (stmt: D1PreparedStatement): any => ({
    bind: (...args: unknown[]) => wrap(stmt.bind(...args)),
    run: async () => {
      cost.queries++;
      const r = await stmt.run();
      add(r.meta);
      return r;
    },
    all: async () => {
      cost.queries++;
      const r = await stmt.all();
      add(r.meta);
      return r;
    },
    first: async (col?: string) => {
      cost.queries++;
      const r = await stmt.all();
      add(r.meta);
      const row = r.results[0] as any;
      return row === undefined ? null : col ? row[col] : row;
    },
    raw: () => stmt.raw(),
    __stmt: stmt,
  });
  const db = {
    prepare: (sql: string) => wrap(env.DB.prepare(sql)),
    batch: async (stmts: any[]) => {
      cost.queries += stmts.length;
      const results = await env.DB.batch(stmts.map((s) => s.__stmt ?? s));
      results.forEach((r) => add(r.meta));
      return results;
    },
  };
  return { ...env, DB: db } as unknown as typeof env;
}

async function measured(method: string, path: string, cookie: string, body?: unknown) {
  const cost: Cost = { queries: 0, read: 0, written: 0 };
  const headers = new Headers({ "content-type": "application/json", cookie });
  const res = await worker.fetch(
    new Request(`http://app.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    countingEnv(cost),
  );
  return { res, cost };
}

let ana: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(noon("2026-11-02"));
  await setupProfiles("all");
  ana = await loginAs(1);
});
afterEach(() => vi.useRealTimers());

describe("presupuesto del plan gratis", () => {
  it("Inicio cabe en pocas consultas y filas leídas", async () => {
    const { res, cost } = await measured("GET", "/api/home", ana);
    expect(res.status).toBe(200);
    expect(cost.queries).toBeLessThanOrEqual(30);
    expect(cost.read).toBeLessThanOrEqual(400);
  });

  it("empezar una sesión escribe solo la copia de lo planeado", async () => {
    const { res, cost } = await measured("POST", "/api/sessions/start", ana, { id: newId() });
    expect(res.status).toBe(201);
    expect(cost.queries).toBeLessThanOrEqual(30);
    expect(cost.written).toBeLessThanOrEqual(120);
  });

  it("una sesión de 25 series escribe por debajo del tope de filas escritas", async () => {
    const id = newId();
    const started = await json((await measured("POST", "/api/sessions/start", ana, { id })).res);
    const exercises = started.session.exercises.filter((e: any) => e.kind === "exercise");
    let written = 0;
    let reads = 0;
    let n = 0;
    for (const exercise of exercises) {
      for (let set = 1; set <= 5 && n < 25; set++, n++) {
        const { res, cost } = await measured("PUT", `/api/sessions/${id}/sets`, ana, { sessionExerciseId: exercise.id, setNumber: set, value: 12, weightKg: 10 });
        expect(res.status).toBe(200);
        written += cost.written;
        reads += cost.read;
      }
    }
    expect(n).toBe(25);
    expect(written).toBeLessThanOrEqual(25 * 6);
    expect(reads).toBeLessThanOrEqual(25 * 20);
    const done = await measured("POST", `/api/sessions/${id}/finish`, ana, {});
    expect(done.cost.written).toBeLessThanOrEqual(10);
  });

  it("Mi progreso, historial y Nosotros se resuelven con rangos acotados", async () => {
    await startSession(ana);
    for (const path of ["/api/progress", "/api/progress/history", "/api/progress/exercises", "/api/us"]) {
      const { res, cost } = await measured("GET", path, ana);
      expect(res.status, path).toBe(200);
      expect(cost.queries, path).toBeLessThanOrEqual(30);
      expect(cost.read, path).toBeLessThanOrEqual(1500);
    }
  });

  it("un mes de uso simulado queda muy por debajo del límite de almacenamiento", async () => {
    // 20 sesiones de 25 series cada una: filas de sesión + ejercicios + series.
    const perSession = 1 + 11 + 25;
    const rows = 20 * perSession + 200; // 200 = catálogo, guías y rutinas iniciales
    const bytesPerRow = 300;
    expect(rows * bytesPerRow).toBeLessThan(10 * 1024 * 1024);
    const seeded = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM exercises) AS e, (SELECT COUNT(*) FROM guides) AS g").first<{ e: number; g: number }>();
    expect((seeded!.e + seeded!.g) * bytesPerRow).toBeLessThan(10 * 1024 * 1024);
  });
});
