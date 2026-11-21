// Uso: npm run seed -- "Nombre 1" "Nombre 2"
// Escribe seed/out/seed.sql para pegarlo en la consola de D1 (o aplicarlo en local).
import { mkdirSync, writeFileSync } from "node:fs";
import { buildSeed } from "../seed/build.ts";

const [name1 = "Persona 1", name2 = "Persona 2"] = process.argv.slice(2);
const statements = buildSeed({ names: [name1, name2] });
const sql = statements.map((s) => `${s};`).join("\n") + "\n";

mkdirSync("seed/out", { recursive: true });
writeFileSync("seed/out/seed.sql", sql);
console.log(`Escrito seed/out/seed.sql (${statements.length} sentencias)`);
