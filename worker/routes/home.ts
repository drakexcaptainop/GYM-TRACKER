import { Hono } from "hono";
import { localDate, weekdayOf } from "../../shared/dates.ts";
import type { AppEnv } from "../env.ts";
import { closePastDays } from "../lib/day-log.ts";
import { scheduledFor, sessionsThisWeek, streakOf, todayState, weekOf } from "../lib/today.ts";

export const homeRoutes = new Hono<AppEnv>();

// Una sola request para Inicio: lo de hoy, la semana, la racha y la sesion abierta.
homeRoutes.get("/home", async (c) => {
  const profileId = c.get("profileId");
  const db = c.env.DB;
  const today = localDate(Date.now());
  await closePastDays(db, profileId, today);

  const [profile, scheduled, state, week, streak, done, open, routine] = await Promise.all([
    db.prepare("SELECT id, name FROM profiles WHERE id = ?").bind(profileId).first(),
    scheduledFor(db, profileId, weekdayOf(today)),
    todayState(db, profileId, today),
    weekOf(db, profileId, today),
    streakOf(db, profileId, today),
    sessionsThisWeek(db, profileId, today),
    db
      .prepare("SELECT id, status FROM sessions WHERE profile_id = ? AND status != 'completed' LIMIT 1")
      .bind(profileId)
      .first<{ id: string; status: string }>(),
    db
      .prepare("SELECT id, name, reduced_volume_until FROM routines WHERE profile_id = ? AND is_active = 1")
      .bind(profileId)
      .first<{ id: number; name: string; reduced_volume_until: string | null }>(),
  ]);

  return c.json({
    profile,
    date: today,
    today: scheduled ? { ...scheduled, state } : { kind: "rest", title: "", exerciseCount: 0, state },
    openSession: open ?? null,
    week,
    streak,
    sessionsThisWeek: done,
    routine: routine
      ? { id: routine.id, name: routine.name, reducedVolumeUntil: routine.reduced_volume_until }
      : null,
  });
});
