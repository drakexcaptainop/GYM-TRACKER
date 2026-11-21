import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { buildSeed } from "../seed/build.ts";

const db = env.DB;

async function runSeed() {
  await db.batch(buildSeed({ names: ["Ana", "Luis"], scope: "profiles" }).map((s) => db.prepare(s)));
}

async function count(table: string) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row!.n;
}

describe("esquema", () => {
  it("crea todas las tablas", async () => {
    const { results } = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const t of [
      "profiles",
      "login_lock",
      "exercises",
      "guides",
      "routines",
      "routine_days",
      "routine_warmup_items",
      "routine_day_exercises",
      "sessions",
      "session_exercises",
      "session_sets",
      "day_log",
      "messages",
    ]) {
      expect(names).toContain(t);
    }
  });

  it("solo permite una rutina activa por perfil", async () => {
    await runSeed();
    await db.prepare("INSERT INTO routines (id, profile_id, name, is_active) VALUES (101, 1, 'A', 1)").run();
    await expect(
      db.prepare("INSERT INTO routines (id, profile_id, name, is_active) VALUES (102, 1, 'B', 1)").run(),
    ).rejects.toThrow();
    await db.prepare("INSERT INTO routines (id, profile_id, name, is_active) VALUES (103, 2, 'C', 1)").run();
    await db.prepare("INSERT INTO routines (id, profile_id, name, is_active) VALUES (104, 1, 'D', 0)").run();
  });

  it("el seed repetido deja las mismas filas", async () => {
    await runSeed();
    const before = [await count("profiles"), await count("login_lock")];
    await runSeed();
    expect([await count("profiles"), await count("login_lock")]).toEqual(before);
    expect(before[0]).toBe(2);
  });

  it("el seed completo repetido deja el mismo numero de ejercicios y rutinas", async () => {
    const full = () => db.batch(buildSeed({ names: ["Ana", "Luis"] }).map((q) => db.prepare(q)));
    await full();
    const before = [await count("exercises"), await count("routines"), await count("routine_day_exercises"), await count("guides")];
    await full();
    expect([await count("exercises"), await count("routines"), await count("routine_day_exercises"), await count("guides")]).toEqual(before);
    expect(before.slice(0, 2)).toEqual([33, 2]);
  });

  it("borrar una rutina no toca las sesiones ya guardadas", async () => {
    await runSeed();
    await db.prepare("INSERT INTO routines (id, profile_id, name) VALUES (201, 1, 'R')").run();
    await db
      .prepare(
        "INSERT INTO sessions (id, profile_id, local_date, routine_name, day_title, started_at) VALUES ('s1', 1, '2026-11-02', 'R', 'Lunes', 1)",
      )
      .run();
    await db.prepare("DELETE FROM routines WHERE id = 201").run();
    const row = await db.prepare("SELECT routine_name FROM sessions WHERE id = 's1'").first<{ routine_name: string }>();
    expect(row?.routine_name).toBe("R");
  });
});
