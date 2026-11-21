// Prepara una base D1 LOCAL (en .wrangler/state) para la prueba de punta a punta. No toca la cuenta de Cloudflare.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });

rmSync(".wrangler/state", { recursive: true, force: true });
mkdirSync("e2e/.tmp", { recursive: true });
if (!existsSync(".dev.vars")) writeFileSync(".dev.vars", "SESSION_SECRET=clave-local-solo-para-pruebas-0123456789\n");

run("npx", ["wrangler", "d1", "migrations", "apply", "gym-tracker", "--local"]);
run("node", ["--experimental-strip-types", "scripts/seed.ts", "Ana", "Luis"]);
run("npx", ["wrangler", "d1", "execute", "gym-tracker", "--local", "--file", "seed/out/seed.sql"]);

for (const [id, pin] of [[1, "111111"], [2, "222222"]]) {
  const sql = execFileSync("node", ["--experimental-strip-types", "scripts/set-pin.ts", String(id), pin], { encoding: "utf8" });
  writeFileSync("e2e/.tmp/pin.sql", sql);
  run("npx", ["wrangler", "d1", "execute", "gym-tracker", "--local", "--file", "e2e/.tmp/pin.sql"]);
}
rmSync("e2e/.tmp", { recursive: true, force: true });
