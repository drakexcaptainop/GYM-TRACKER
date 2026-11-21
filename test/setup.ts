import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

const TABLES = [
  "session_sets",
  "session_exercises",
  "sessions",
  "day_log",
  "messages",
  "routine_day_exercises",
  "routine_warmup_items",
  "routine_days",
  "routines",
  "guides",
  "exercises",
  "login_lock",
  "profiles",
];

// El estado de D1 se conserva entre pruebas del mismo archivo: cada una arranca de cero.
beforeEach(async () => {
  await env.DB.batch(TABLES.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});
