import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";

export function fail(status: 400 | 401 | 403 | 404 | 409 | 429, code: string): never {
  throw new HTTPException(status, { res: Response.json({ error: code }, { status }) });
}

export async function readBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) fail(400, "invalid_body");
  return parsed.data;
}

export function intParam(c: Context, name: string): number {
  const value = Number(c.req.param(name));
  if (!Number.isInteger(value) || value < 1) fail(404, "not_found");
  return value;
}

export function weekdayParam(c: Context): number {
  const value = Number(c.req.param("weekday"));
  if (!Number.isInteger(value) || value < 1 || value > 7) fail(404, "not_found");
  return value;
}
