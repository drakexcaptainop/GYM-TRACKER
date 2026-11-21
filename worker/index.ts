import { Hono } from "hono";
import { jsonOnly, requireProfile } from "./auth/middleware.ts";
import type { AppEnv } from "./env.ts";
import { authRoutes } from "./routes/auth.ts";

const app = new Hono<AppEnv>();

app.use("/api/*", jsonOnly, requireProfile);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api", authRoutes);

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

export default app;
