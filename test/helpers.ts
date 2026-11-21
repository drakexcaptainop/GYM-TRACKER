import { env } from "cloudflare:workers";
import worker from "../worker/index.ts";
import { PIN_ITERATIONS, hashPin, newSalt } from "../worker/auth/pin.ts";
import { buildSeed } from "../seed/build.ts";

export function call(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  return worker.fetch(new Request(`http://app.test${path}`, { ...init, headers }), env);
}

export function post(path: string, body: unknown, cookie?: string) {
  return call(path, { method: "POST", body: JSON.stringify(body), cookie });
}

export async function seedProfiles(scope: "profiles" | "all" = "profiles") {
  await env.DB.batch(buildSeed({ names: ["Ana", "Luis"], scope }).map((s) => env.DB.prepare(s)));
}

export async function setPin(profileId: number, pin: string) {
  const salt = newSalt();
  const hash = await hashPin(pin, salt, PIN_ITERATIONS);
  await env.DB.prepare("UPDATE profiles SET pin_salt = ?, pin_hash = ?, pin_iterations = ? WHERE id = ?")
    .bind(salt, hash, PIN_ITERATIONS, profileId)
    .run();
}

/** Crea los dos perfiles con PIN 111111 (Ana, id 1) y 222222 (Luis, id 2). */
export async function setupProfiles(scope: "profiles" | "all" = "profiles") {
  await seedProfiles(scope);
  await setPin(1, "111111");
  await setPin(2, "222222");
}

export async function loginAs(profileId: 1 | 2): Promise<string> {
  const res = await post("/api/auth/login", { profileId, pin: profileId === 1 ? "111111" : "222222" });
  if (res.status !== 200) throw new Error(`login fallo: ${res.status}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0]!;
}
