import { addDays, dateRange, localDate, weekdayOf } from "../../shared/dates.ts";

const MAX_CLOSE_DAYS = 400;

/** Tipo de cada dia de la semana (1..7) segun la rutina activa; sin rutina, todo es descanso. */
async function scheduleOf(db: D1Database, profileId: number): Promise<{ kinds: Map<number, string>; startDate: string | null }> {
  const routine = await db
    .prepare("SELECT id, created_at FROM routines WHERE profile_id = ? AND is_active = 1")
    .bind(profileId)
    .first<{ id: number; created_at: number }>();
  if (!routine) return { kinds: new Map(), startDate: null };
  const { results } = await db
    .prepare("SELECT weekday, kind FROM routine_days WHERE routine_id = ?")
    .bind(routine.id)
    .all<{ weekday: number; kind: string }>();
  return {
    kinds: new Map(results.map((r) => [r.weekday, r.kind])),
    startDate: routine.created_at > 0 ? localDate(routine.created_at) : null,
  };
}

/**
 * Cierra de forma idempotente los dias pasados sin fila: pendiente si estaba programada
 * una sesion, descanso si no. Hoy, que sigue abierto, nunca se cierra.
 * Se llama al leer y siempre antes de cambiar la rutina, para no reescribir el pasado.
 */
export async function closePastDays(db: D1Database, profileId: number, today: string): Promise<void> {
  const last = await db
    .prepare("SELECT MAX(date) AS d FROM day_log WHERE profile_id = ?")
    .bind(profileId)
    .first<{ d: string | null }>();

  const { kinds, startDate } = await scheduleOf(db, profileId);
  const from = last?.d ? addDays(last.d, 1) : startDate;
  if (!from) return;

  const yesterday = addDays(today, -1);
  const dates = dateRange(from, yesterday).slice(-MAX_CLOSE_DAYS);
  if (dates.length === 0) return;

  // Una sola sentencia para cualquier cantidad de días: no depende del tope de consultas por request.
  const rows = dates.map((date) => [date, kinds.get(weekdayOf(date)) === "session" ? "pending" : "rest"]);
  await db
    .prepare(
      `INSERT OR IGNORE INTO day_log (profile_id, date, status)
       SELECT ?1, json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?2)`,
    )
    .bind(profileId, JSON.stringify(rows))
    .run();
}

/**
 * Anota el dia de hoy al terminar una sesion: completado si era un dia programado;
 * una sesion extra en un descanso programado queda como descanso y no cambia la racha.
 */
export async function recordFinishedDay(db: D1Database, profileId: number, date: string, sessionId: string): Promise<void> {
  await closePastDays(db, profileId, date);
  const { kinds } = await scheduleOf(db, profileId);
  if (kinds.get(weekdayOf(date)) === "session") {
    await db
      .prepare(
        `INSERT INTO day_log (profile_id, date, status, session_id) VALUES (?, ?, 'completed', ?)
         ON CONFLICT (profile_id, date) DO UPDATE SET status = 'completed', session_id = excluded.session_id
         WHERE day_log.status != 'completed'`,
      )
      .bind(profileId, date, sessionId)
      .run();
  } else {
    await db.prepare("INSERT OR IGNORE INTO day_log (profile_id, date, status) VALUES (?, ?, 'rest')").bind(profileId, date).run();
  }
}
