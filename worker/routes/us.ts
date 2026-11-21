import { Hono } from "hono";
import { z } from "zod";
import { addDays, localDate, startOfWeek } from "../../shared/dates.ts";
import { PHRASES, PHRASE_KEYS, phraseText } from "../../shared/phrases.ts";
import type { DayStatus } from "../../shared/schemas.ts";
import type { AppEnv } from "../env.ts";
import { closePastDays } from "../lib/day-log.ts";
import { fail, readBody } from "../lib/http.ts";
import { sessionsThisWeek, streakOf, todayState } from "../lib/today.ts";

export const usRoutes = new Hono<AppEnv>();

const WEEKS_SHOWN = 5;

// "Nosotros" devuelve solo la lista blanca compartida: nombre, racha, sesiones de la semana,
// estado de hoy, calendario de estados y mensajes recibidos. La respuesta nunca incluye rutinas, pesos ni series (el horario solo se usa para derivar estados).
usRoutes.get("/us", async (c) => {
  const me = c.get("profileId");
  const db = c.env.DB;
  const today = localDate(Date.now());
  const { results: people } = await db.prepare("SELECT id, name FROM profiles ORDER BY id").all<{ id: number; name: string }>();

  const from = addDays(startOfWeek(today), -7 * (WEEKS_SHOWN - 1));
  const to = addDays(startOfWeek(today), 6);

  const cards = await Promise.all(
    people.map(async (person) => {
      await closePastDays(db, person.id, today);
      const [streak, week, state, { results: rows }] = await Promise.all([
        streakOf(db, person.id, today),
        sessionsThisWeek(db, person.id, today),
        todayState(db, person.id, today),
        db
          .prepare("SELECT date, status FROM day_log WHERE profile_id = ? AND date BETWEEN ? AND ?")
          .bind(person.id, from, today)
          .all<{ date: string; status: DayStatus }>(),
      ]);
      const byDate = new Map(rows.map((r) => [r.date, r.status]));
      const calendar: { date: string; status: DayStatus | null }[] = [];
      for (let date = from; date <= to; date = addDays(date, 1)) {
        calendar.push({ date, status: date < today ? (byDate.get(date) ?? null) : date === today ? state : null });
      }
      return { id: person.id, name: person.name, isMe: person.id === me, streak, sessionsThisWeek: week, today: state, calendar };
    }),
  );

  const { results: inbox } = await db
    .prepare(
      `SELECT m.id, m.from_profile_id, p.name AS from_name, m.phrase_key, m.created_at
       FROM messages m JOIN profiles p ON p.id = m.from_profile_id
       WHERE m.to_profile_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 20`,
    )
    .bind(me)
    .all<{ id: number; from_profile_id: number; from_name: string; phrase_key: string; created_at: number }>();

  return c.json({
    today,
    people: cards,
    phrases: PHRASES,
    messages: inbox.map((m) => ({
      id: m.id,
      fromId: m.from_profile_id,
      fromName: m.from_name,
      key: m.phrase_key,
      text: phraseText(m.phrase_key) ?? "",
      createdAt: m.created_at,
    })),
  });
});

const messageSchema = z.object({ phraseKey: z.enum(PHRASE_KEYS) });

// Solo claves de la lista: no existe texto libre. Se puede enviar tanto a quien ya entreno como a quien esta pendiente.
usRoutes.post("/messages", async (c) => {
  const me = c.get("profileId");
  const { phraseKey } = await readBody(c, messageSchema);
  const other = await c.env.DB.prepare("SELECT id FROM profiles WHERE id != ? ORDER BY id LIMIT 1").bind(me).first<{ id: number }>();
  if (!other) fail(404, "not_found");
  const created = await c.env.DB.prepare("INSERT INTO messages (from_profile_id, to_profile_id, phrase_key, created_at) VALUES (?, ?, ?, ?)")
    .bind(me, other.id, phraseKey, Date.now())
    .run();
  return c.json({ id: created.meta.last_row_id }, 201);
});
