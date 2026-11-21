import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { MAX_FAILURES, isLocked, waitAfterFailures, type LockRow } from "../auth/lock.ts";
import { verifyPin } from "../auth/pin.ts";
import { SESSION_COOKIE, SESSION_SECONDS, signSession } from "../auth/session.ts";
import type { AppEnv } from "../env.ts";

const loginSchema = z.object({
  profileId: z.number().int().positive(),
  pin: z.string().regex(/^\d{6}$/),
});

interface ProfileRow {
  id: number;
  name: string;
  pin_salt: string | null;
  pin_hash: string | null;
  pin_iterations: number | null;
}

export const authRoutes = new Hono<AppEnv>();

// Lista publica: solo ids y nombres, para elegir perfil en la pantalla de acceso.
authRoutes.get("/profiles", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name FROM profiles ORDER BY id").all();
  return c.json({ profiles: results });
});

authRoutes.post("/auth/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const { profileId, pin } = parsed.data;
  const now = Date.now();

  const [profileRes, lockRes] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT id, name, pin_salt, pin_hash, pin_iterations FROM profiles WHERE id = ?").bind(profileId),
    c.env.DB.prepare("SELECT failures, locked_until FROM login_lock WHERE profile_id = ?").bind(profileId),
  ]);
  const profile = (profileRes!.results[0] as ProfileRow | undefined) ?? null;
  const lock = (lockRes!.results[0] as LockRow | undefined) ?? null;

  // Perfil desconocido: misma respuesta que un PIN incorrecto y sin escribir nada.
  if (!profile || !lock) return c.json({ error: "invalid_credentials" }, 401);

  if (isLocked(lock, now)) {
    return c.json({ error: "locked", retryAfterSeconds: Math.ceil((lock.locked_until - now) / 1000) }, 429);
  }

  const ok = await verifyPin(pin, { salt: profile.pin_salt, hash: profile.pin_hash, iterations: profile.pin_iterations });
  if (!ok) {
    const failures = lock.failures + 1;
    const wait = waitAfterFailures(failures);
    await c.env.DB.prepare("UPDATE login_lock SET failures = ?, locked_until = ? WHERE profile_id = ?")
      .bind(failures, wait > 0 ? now + wait : 0, profileId)
      .run();
    const body: Record<string, unknown> = { error: "invalid_credentials" };
    if (failures >= MAX_FAILURES) body.retryAfterSeconds = Math.ceil(wait / 1000);
    return c.json(body, 401);
  }

  if (lock.failures > 0) {
    await c.env.DB.prepare("UPDATE login_lock SET failures = 0, locked_until = 0 WHERE profile_id = ?").bind(profileId).run();
  }

  const token = await signSession(profile.id, c.env.SESSION_SECRET, Math.floor(now / 1000));
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return c.json({ profile: { id: profile.id, name: profile.name } });
});

authRoutes.post("/auth/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const profile = await c.env.DB.prepare("SELECT id, name FROM profiles WHERE id = ?").bind(c.get("profileId")).first();
  if (!profile) return c.json({ error: "unauthorized" }, 401);
  return c.json({ profile });
});
