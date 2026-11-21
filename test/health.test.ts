import { describe, expect, it } from "vitest";
import { call } from "./helpers.ts";

describe("health", () => {
  it("responde 200 con JSON", async () => {
    const res = await call("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("una ruta desconocida bajo /api devuelve 404 JSON", async () => {
    const res = await call("/api/nada");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
