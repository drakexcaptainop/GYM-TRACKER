import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { jsonOnly, requireProfile } from "./auth/middleware.ts";
import type { AppEnv } from "./env.ts";
import { authRoutes } from "./routes/auth.ts";
import { exerciseRoutes } from "./routes/exercises.ts";
import { routineRoutes } from "./routes/routines.ts";

const app = new Hono<AppEnv>();

app.use("/api/*", jsonOnly, requireProfile);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api", authRoutes);
app.route("/api", exerciseRoutes);
app.route("/api", routineRoutes);

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  console.error(error);
  return c.json({ error: "server_error" }, 500);
});

export default app;
