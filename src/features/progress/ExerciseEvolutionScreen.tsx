import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api.ts";
import type { EvolutionPoint, Measure } from "../../lib/types.ts";
import { Card } from "../../ui/Card.tsx";
import { LineChart } from "../../ui/Charts.tsx";
import { ErrorNote, Loading, Screen } from "../../ui/Screen.tsx";
import { shortDate } from "../../ui/format.ts";

export function ExerciseEvolutionScreen() {
  const id = useParams().id;
  const q = useQuery({
    queryKey: ["evolution", id],
    queryFn: () => api<{ name: string; measure: Measure; points: EvolutionPoint[] }>(`/api/progress/exercises/${id}`),
  });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Screen title="Ejercicio"><ErrorNote message="Todavía no hay registros de este ejercicio." /></Screen>;
  const { name, points } = q.data;
  const hasWeight = points.some((p) => p.bestWeightKg);
  const series = points.map((p) => ({ label: shortDate(p.date), value: hasWeight ? p.bestWeightKg : p.bestValue }));
  return (
    <Screen title={name} subtitle={hasWeight ? "Mayor peso por sesión (kg)" : "Mejor serie por sesión"}>
      <Link to="/progreso" className="mb-3 inline-block text-sm text-muted">← Mi progreso</Link>
      <Card>
        <LineChart data={series} label={`Evolución de ${name}`} />
      </Card>
      <ul className="mt-4 flex flex-col gap-2">
        {[...points].reverse().map((p) => (
          <li key={p.date} className="flex justify-between rounded-2xl bg-surface px-4 py-3 text-sm">
            <span>{shortDate(p.date)}</span>
            <span className="text-muted">
              {p.sets} series · mejor {p.bestValue ?? "–"}{p.bestWeightKg ? ` × ${p.bestWeightKg} kg` : ""}
            </span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
