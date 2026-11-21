import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { call, loginAs, post, setupProfiles } from "./helpers.ts";

beforeEach(async () => {
  await setupProfiles();
});

async function lockRow(id: number) {
  return env.DB.prepare("SELECT failures, locked_until FROM login_lock WHERE profile_id = ?")
    .bind(id)
    .first<{ failures: number; locked_until: number }>();
}

describe("acceso por PIN", () => {
  it("login correcto devuelve cookie HttpOnly y /api/me responde con el perfil", async () => {
    const res = await post("/api/auth/login", { profileId: 1, pin: "111111" });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);

    const me = await call("/api/me", { cookie: setCookie.split(";")[0] });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ profile: { id: 1, name: "Ana" } });
  });

  it("una ruta protegida sin cookie devuelve 401", async () => {
    expect((await call("/api/me")).status).toBe(401);
  });

  it("una cookie alterada devuelve 401", async () => {
    const cookie = await loginAs(1);
    const tampered = cookie.slice(0, -3) + (cookie.endsWith("aaa") ? "bbb" : "aaa");
    expect((await call("/api/me", { cookie: tampered })).status).toBe(401);
  });

  it("una cookie de otro perfil firmada con otro secreto devuelve 401", async () => {
    const { signSession } = await import("../worker/auth/session.ts");
    const forged = await signSession(1, "otro-secreto-distinto-0123456789abcdef", Math.floor(Date.now() / 1000));
    expect((await call("/api/me", { cookie: `gt_session=${forged}` })).status).toBe(401);
  });

  it("una cookie vencida devuelve 401", async () => {
    const { signSession, SESSION_SECONDS } = await import("../worker/auth/session.ts");
    const old = await signSession(1, env.SESSION_SECRET, Math.floor(Date.now() / 1000) - SESSION_SECONDS - 10);
    expect((await call("/api/me", { cookie: `gt_session=${old}` })).status).toBe(401);
  });

  it("cinco PIN incorrectos bloquean el perfil; el sexto intento correcto responde bloqueo", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await post("/api/auth/login", { profileId: 1, pin: "000000" });
      expect(res.status).toBe(401);
    }
    const locked = await post("/api/auth/login", { profileId: 1, pin: "111111" });
    expect(locked.status).toBe(429);
    const body = (await locked.json()) as { error: string; retryAfterSeconds: number };
    expect(body.error).toBe("locked");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("durante el bloqueo no se escribe ninguna fila", async () => {
    for (let i = 0; i < 5; i++) await post("/api/auth/login", { profileId: 1, pin: "000000" });
    const before = await lockRow(1);
    await post("/api/auth/login", { profileId: 1, pin: "000000" });
    await post("/api/auth/login", { profileId: 1, pin: "111111" });
    expect(await lockRow(1)).toEqual(before);
  });

  it("el bloqueo de un perfil no afecta el login del otro", async () => {
    for (let i = 0; i < 5; i++) await post("/api/auth/login", { profileId: 1, pin: "000000" });
    expect((await post("/api/auth/login", { profileId: 2, pin: "222222" })).status).toBe(200);
  });

  it("un login correcto reinicia los fallos", async () => {
    await post("/api/auth/login", { profileId: 1, pin: "000000" });
    await post("/api/auth/login", { profileId: 1, pin: "111111" });
    expect((await lockRow(1))!.failures).toBe(0);
  });

  it("un perfil inexistente o sin PIN da la misma respuesta que un PIN incorrecto", async () => {
    const wrong = await post("/api/auth/login", { profileId: 1, pin: "999999" });
    const missing = await post("/api/auth/login", { profileId: 99, pin: "999999" });
    expect(missing.status).toBe(wrong.status);
    expect(await missing.json()).toEqual({ error: "invalid_credentials" });
    await env.DB.prepare("UPDATE profiles SET pin_hash = NULL WHERE id = 2").run();
    expect((await post("/api/auth/login", { profileId: 2, pin: "222222" })).status).toBe(401);
  });

  it("cerrar sesión borra la cookie y se puede volver a entrar", async () => {
    const res = await post("/api/auth/logout", {});
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/gt_session=;/);
    expect((await post("/api/auth/login", { profileId: 1, pin: "111111" })).status).toBe(200);
  });

  it("rechaza una escritura cuyo cuerpo no es JSON", async () => {
    const res = await call("/api/auth/login", {
      method: "POST",
      body: "profileId=1&pin=111111",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(res.status).toBe(415);
  });

  it("rechaza un PIN que no tiene seis dígitos", async () => {
    expect((await post("/api/auth/login", { profileId: 1, pin: "1234" })).status).toBe(400);
  });

  it("la lista de perfiles es pública y solo expone id y nombre", async () => {
    const res = await call("/api/profiles");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      profiles: [
        { id: 1, name: "Ana" },
        { id: 2, name: "Luis" },
      ],
    });
  });
});

describe("bloqueo bajo intentos simultáneos", () => {
  it("diez PIN incorrectos en paralelo cuentan todos y dejan el perfil bloqueado", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => post("/api/auth/login", { profileId: 1, pin: "000000" })));
    expect(results.every((r) => r.status === 401 || r.status === 429)).toBe(true);
    const row = await env.DB.prepare("SELECT failures, locked_until FROM login_lock WHERE profile_id = 1").first<{ failures: number; locked_until: number }>();
    expect(row!.failures).toBeGreaterThanOrEqual(5);
    expect(row!.locked_until).toBeGreaterThan(Date.now());
    expect((await post("/api/auth/login", { profileId: 1, pin: "111111" })).status).toBe(429);
  });
});
