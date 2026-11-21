import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.ts";
import type { HistoryEntry, Progress } from "../../lib/types.ts";
import { BarChart } from "../../ui/Charts.tsx";
import { Card, SectionTitle } from "../../ui/Card.tsx";
import { ErrorNote, Loading, Screen } from "../../ui/Screen.tsx";
import { minutesText, shortDate } from "../../ui/format.ts";

export function ProgressScreen() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: () => api<Progress>("/api/progress") });
  const history = useQuery({ queryKey: ["history"], queryFn: () => api<{ sessions: HistoryEntry[] }>("/api/progress/history?limit=20") });
  const exercises = useQuery({ queryKey: ["progress-exercises"], queryFn: () => api<{ exercises: { id: number; name: string }[] }>("/api/progress/exercises") });

  if (progress.isPending) return <Loading />;
  if (progress.isError) return <Screen title="Mi progreso"><ErrorNote /></Screen>;
  const p = progress.data;

  return (
    <Screen title="Mi progreso" subtitle="Solo tú ves esto.">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card><p className="text-3xl font-bold text-cyan">{p.completedSessions}</p><p className="text-xs text-muted">entrenamientos</p></Card>
        <Card><p className="text-3xl font-bold text-cyan">{p.compliance === null ? "–" : `${p.compliance}%`}</p><p className="text-xs text-muted">cumplimiento</p></Card>
      </div>

      <Card>
        <p className="mb-2 text-sm font-semibold">Sesiones por semana</p>
        <BarChart label="Sesiones por semana" data={p.sessionsPerWeek.map((w) => ({ label: shortDate(w.weekStart), value: w.sessions }))} />
      </Card>

      <SectionTitle>Evolución por ejercicio</SectionTitle>
      {exercises.data?.exercises.length === 0 && <p className="text-sm text-muted">Aparecerán cuando registres series.</p>}
      <ul className="flex flex-wrap gap-2">
        {exercises.data?.exercises.map((e) => (
          <li key={e.id}>
            <Link to={`/progreso/ejercicio/${e.id}`} className="flex min-h-11 items-center rounded-2xl border border-line bg-surface px-4 text-sm">{e.name}</Link>
          </li>
        ))}
      </ul>

      <SectionTitle>Historial</SectionTitle>
      {history.data?.sessions.length === 0 && <p className="text-sm text-muted">Todavía no hay entrenamientos terminados.</p>}
      <ul className="flex flex-col gap-2">
        {history.data?.sessions.map((s) => (
          <li key={s.id}>
            <Link to={`/progreso/sesion/${s.id}`}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.dayTitle}</p>
                  <p className="text-sm text-muted">{shortDate(s.localDate)} · {s.exercisesCompleted} ejercicios · {s.setsDone} series</p>
                </div>
                <span className="text-sm text-muted">{minutesText(s.durationSeconds)}</span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
