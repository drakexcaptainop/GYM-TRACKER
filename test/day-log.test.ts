import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { closePastDays, recordFinishedDay } from "../worker/lib/day-log.ts";
import { seedProfiles } from "./helpers.ts";

const db = env.DB;
// Lunes 2026-11-02 ... domingo 2026-11-08. La rutina programa sesion lunes, martes y jueves.
const MON = "2026-11-02";

async function routine(profileId: number, createdAt: number, sessionDays: number[], id = 1, active = 1) {
  await db.prepare("INSERT INTO routines (id, profile_id, name, is_active, created_at) VALUES (?, ?, 'R', ?, ?)").bind(id, profileId, active, createdAt).run();
  for (let wd = 1; wd <= 7; wd++) {
    await db
      .prepare("INSERT INTO routine_days (routine_id, weekday, kind, title) VALUES (?, ?, ?, 'x')")
      .bind(id, wd, sessionDays.includes(wd) ? "session" : "rest")
      .run();
  }
}

async function rows(profileId: number) {
  const { results } = await db
    .prepare("SELECT date, status FROM day_log WHERE profile_id = ? ORDER BY date")
    .bind(profileId)
    .all<{ date: string; status: string }>();
  return results;
}

const at = (date: string) => Date.parse(`${date}T12:00:00Z`);

beforeEach(async () => {
  await seedProfiles();
});

describe("cierre de dias", () => {
  it("un dia pasado programado como sesion queda pendiente y uno de descanso queda descanso", async () => {
    await routine(1, at(MON), [1, 2, 4]);
    await closePastDays(db, 1, "2026-11-06");
    expect(await rows(1)).toEqual([
      { date: "2026-11-02", status: "pending" },
      { date: "2026-11-03", status: "pending" },
      { date: "2026-11-04", status: "rest" },
      { date: "2026-11-05", status: "pending" },
    ]);
  });

  it("no escribe nada si ya esta al dia y es idempotente", async () => {
    await routine(1, at(MON), [1, 2, 4]);
    await closePastDays(db, 1, "2026-11-06");
    const before = await rows(1);
    await closePastDays(db, 1, "2026-11-06");
    await Promise.all([closePastDays(db, 1, "2026-11-06"), closePastDays(db, 1, "2026-11-06")]);
    expect(await rows(1)).toEqual(before);
  });

  it("hoy, que sigue abierto, no se cierra", async () => {
    await routine(1, at(MON), [1, 2, 4]);
    await closePastDays(db, 1, MON);
    expect(await rows(1)).toEqual([]);
  });

  it("cambiar de rutina un jueves no reclasifica el martes ya cerrado", async () => {
    await routine(1, at(MON), [1, 2, 4], 1, 1);
    await closePastDays(db, 1, "2026-11-05"); // jueves: cierra lunes a miercoles
    // la nueva rutina trabaja martes y miercoles
    await db.prepare("UPDATE routines SET is_active = 0 WHERE id = 1").run();
    await routine(1, at("2026-11-05"), [3], 2, 1);
    await closePastDays(db, 1, "2026-11-06");
    const got = Object.fromEntries((await rows(1)).map((r) => [r.date, r.status]));
    expect(got["2026-11-03"]).toBe("pending");
    expect(got["2026-11-04"]).toBe("rest");
    expect(got["2026-11-05"]).toBe("rest"); // el jueves se cierra con la rutina nueva: descanso
  });

  it("sin rutina activa ni filas previas no se inventa pasado", async () => {
    await closePastDays(db, 1, "2026-11-06");
    expect(await rows(1)).toEqual([]);
  });
});

describe("dia terminado", () => {
  it("una sesion en un dia programado queda completada y rellena los dias anteriores", async () => {
    await routine(1, at(MON), [1, 2, 4]);
    await recordFinishedDay(db, 1, "2026-11-03", "s-1");
    expect(await rows(1)).toEqual([
      { date: "2026-11-02", status: "pending" },
      { date: "2026-11-03", status: "completed" },
    ]);
  });

  it("una sesion extra en un dia de descanso no cuenta como completado", async () => {
    await routine(1, at(MON), [1, 2, 4]);
    await recordFinishedDay(db, 1, "2026-11-04", "s-1");
    const got = Object.fromEntries((await rows(1)).map((r) => [r.date, r.status]));
    expect(got["2026-11-04"]).toBe("rest");
  });

  it("terminar dos veces el mismo dia no duplica ni cambia nada", async () => {
    await routine(1, at(MON), [1, 2, 4]);
    await recordFinishedDay(db, 1, "2026-11-02", "s-1");
    await recordFinishedDay(db, 1, "2026-11-02", "s-1");
    expect(await rows(1)).toEqual([{ date: "2026-11-02", status: "completed" }]);
  });
});
