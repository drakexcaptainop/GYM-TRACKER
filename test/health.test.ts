import { beforeEach, describe, expect, it } from "vitest";
import { call, loginAs, setupProfiles } from "./helpers.ts";

beforeEach(async () => {
  await setupProfiles();
});

describe("health", () => {
  it("responde 200 con JSON sin iniciar sesión", async () => {
    const res = await call("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("una ruta desconocida bajo /api devuelve 404 JSON a quien inició sesión", async () => {
    const res = await call("/api/nada", { cookie: await loginAs(1) });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("sin sesión, una ruta desconocida pide iniciar sesión", async () => {
    expect((await call("/api/nada")).status).toBe(401);
  });
});
