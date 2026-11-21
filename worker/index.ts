import { Hono } from "hono";
import type { Env } from "./env.ts";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

export default app;
