// Genera las sentencias SQL (una por elemento, sin parametros) que cargan los datos iniciales.
// Es repetible: cada fila tiene un id fijo y se inserta con "OR IGNORE".

export function lit(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

export interface SeedOptions {
  names: [string, string];
}

export function buildSeed(options: SeedOptions): string[] {
  const statements: string[] = [];
  options.names.forEach((name, index) => {
    const id = index + 1;
    statements.push(`INSERT OR IGNORE INTO profiles (id, name) VALUES (${id}, ${lit(name)})`);
    statements.push(`INSERT OR IGNORE INTO login_lock (profile_id) VALUES (${id})`);
  });
  return statements;
}
