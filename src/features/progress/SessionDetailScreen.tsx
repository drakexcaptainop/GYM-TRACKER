import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api.ts";
import type { Session, SessionSummary } from "../../lib/types.ts";
import { Card } from "../../ui/Card.tsx";
import { ErrorNote, Loading, Screen } from "../../ui/Screen.tsx";
import { minutesText, shortDate } from "../../ui/format.ts";

export function SessionDetailScreen() {
  const id = useParams().id;
  const q = useQuery({ queryKey: ["session", id], queryFn: () => api<{ session: Session; summary: SessionSummary }>(`/api/sessions/${id}`) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Screen title="Sesión"><ErrorNote message="No se encontró la sesión." /></Screen>;
  const { session, summary } = q.data;
  return (
    <Screen title={session.dayTitle} subtitle={`${shortDate(session.localDate)} · ${minutesText(summary.durationSeconds)}`}>
      <Link to="/progreso" className="mb-3 inline-block text-sm text-muted">← Mi progreso</Link>
      <ul className="flex flex-col gap-3">
        {session.exercises.filter((e) => e.kind === "exercise").map((e) => (
          <li key={e.id}>
            <Card>
              <p className="font-semibold">{e.name}</p>
              {e.sets.length === 0 ? (
                <p className="text-sm text-muted">Sin series registradas</p>
              ) : (
                <ul className="mt-1 text-sm text-muted">
                  {e.sets.filter((s) => s.kind === "work").map((s) => (
                    <li key={s.setNumber}>Serie {s.setNumber}: {s.value ?? "–"}{s.weightKg ? ` × ${s.weightKg} kg` : ""}</li>
                  ))}
                </ul>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
