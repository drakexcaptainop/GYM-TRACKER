import { env } from "cloudflare:workers";
import worker from "../worker/index.ts";

export function call(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return worker.fetch(new Request(`http://app.test${path}`, { ...init, headers }), env);
}
