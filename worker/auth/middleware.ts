import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env.ts";
import { SESSION_COOKIE, readSession } from "./session.ts";

const PUBLIC = new Set(["/api/health", "/api/profiles", "/api/auth/login", "/api/auth/logout"]);

/** Las escrituras solo aceptan JSON: junto con SameSite=Strict, cierra el CSRF. */
export const jsonOnly = createMiddleware<AppEnv>(async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const type = c.req.header("content-type") ?? "";
    if (!type.toLowerCase().startsWith("application/json")) {
      return c.json({ error: "json_required" }, 415);
    }
  }
  await next();
});

/** Pone el id del perfil en el contexto a partir de la cookie. Nada mas lo toma de otro lado. */
export const requireProfile = createMiddleware<AppEnv>(async (c, next) => {
  if (PUBLIC.has(c.req.path)) return next();
  const profileId = await readSession(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET, Math.floor(Date.now() / 1000));
  if (profileId === null) return c.json({ error: "unauthorized" }, 401);
  c.set("profileId", profileId);
  await next();
});
