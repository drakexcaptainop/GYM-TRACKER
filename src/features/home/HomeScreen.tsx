import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../../lib/api.ts";
import type { Home, Session } from "../../lib/types.ts";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { ErrorNote, Loading, Screen } from "../../ui/Screen.tsx";
import { StatusMark } from "../../ui/StatusMark.tsx";
import { WEEKDAYS_SHORT } from "../../ui/format.ts";

const DISMISS_KEY = "gt-volume-note-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function useStartSession() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () => api<{ session: Session }>("/api/sessions/start", { method: "POST", body: { id: crypto.randomUUID() } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["home"] });
      await client.invalidateQueries({ queryKey: ["session"] });
      navigate("/entrenar");
    },
    onError: async (e) => {
      if (e instanceof ApiError && e.code === "session_open") {
        await client.invalidateQueries({ queryKey: ["session"] });
        navigate("/entrenar");
        return;
      }
      setError(
        e instanceof ApiError && e.code === "no_exercises_today"
          ? "Hoy no hay ejercicios en tu rutina."
          : "No se pudo empezar. Revisa tu conexión.",
      );
    },
  });
  return { start, error };
}

export function HomeScreen() {
  const navigate = useNavigate();
  const { start, error } = useStartSession();
  const home = useQuery({ queryKey: ["home"], queryFn: () => api<Home>("/api/home") });
  const [dismissed, setDismissed] = useState(readDismissed);

  if (home.isPending) return <Loading />;
  if (home.isError) return <Screen title="Inicio"><ErrorNote /></Screen>;
  const data = home.data;
  const { today } = data;
  const showVolumeNote = !dismissed && data.routine?.reducedVolumeUntil && data.routine.reducedVolumeUntil >= data.date;

  return (
    <Screen title={`Hola, ${data.profile.name}`} subtitle="Constancia, sin presión.">
      <div className="mb-4 flex gap-3">
        <Card className="flex flex-1 items-center gap-3">
          <Flame className="text-amber" aria-hidden="true" />
          <div>
            <p className="text-2xl font-bold leading-none">{data.streak}</p>
            <p className="text-xs text-muted">{data.streak === 1 ? "día de racha" : "días de racha"}</p>
          </div>
        </Card>
        <Card className="flex flex-1 items-center gap-3">
          <div>
            <p className="text-2xl font-bold leading-none">{data.sessionsThisWeek}</p>
            <p className="text-xs text-muted">{data.sessionsThisWeek === 1 ? "sesión esta semana" : "sesiones esta semana"}</p>
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        {data.routine === null ? (
          <>
            <p className="font-semibold">No tienes una rutina activa</p>
            <p className="mt-1 text-sm text-muted">Activa o crea una rutina en “Mis rutinas”.</p>
            <Button className="mt-4" block variant="secondary" onClick={() => navigate("/rutinas")}>
              Ir a Mis rutinas
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wider text-muted">Hoy</p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold">{today.kind === "session" ? today.title : "Día de descanso"}</h2>
              <StatusMark status={today.state} size={28} />
            </div>
            {today.kind === "session" && (
              <p className="mt-1 text-sm text-muted">
                {today.exerciseCount} {today.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
              </p>
            )}

            {data.openSession ? (
              <Button className="mt-4" block size="lg" onClick={() => navigate("/entrenar")}>
                Retomar entrenamiento
              </Button>
            ) : today.state === "completed" ? (
              <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-center font-medium text-cyan">¡Entrenamiento completado!</p>
            ) : today.exerciseCount > 0 ? (
              <Button className="mt-4" block size="lg" disabled={start.isPending} onClick={() => start.mutate()}>
                {today.kind === "rest" ? "Entrenar de todos modos" : "Comenzar entrenamiento"}
              </Button>
            ) : (
              <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-center text-muted">Descansa y recupérate.</p>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-amber">{error}</p>}
          </>
        )}
      </Card>

      {showVolumeNote && (
        <Card className="mb-4 border-primary/40">
          <p className="font-semibold">Primeras dos semanas</p>
          <p className="mt-1 text-sm text-muted">
            Empieza con volumen reducido: hasta 3 series en ejercicios principales y 2 en accesorios. Es una guía: tú decides.
          </p>
          <Button
            className="mt-3"
            variant="ghost"
            onClick={() => {
              try {
                localStorage.setItem(DISMISS_KEY, "1");
              } catch {
                /* sin almacenamiento: solo se oculta ahora */
              }
              setDismissed(true);
            }}
          >
            Entendido
          </Button>
        </Card>
      )}

      <Card>
        <p className="mb-3 text-sm font-semibold">Esta semana</p>
        <ul className="grid grid-cols-7 gap-1 text-center">
          {data.week.map((day, i) => (
            <li key={day.date} className={`flex flex-col items-center gap-2 rounded-2xl py-2 ${day.date === data.date ? "bg-surface-2" : ""}`}>
              <span className="text-xs text-muted">{WEEKDAYS_SHORT[i]}</span>
              <StatusMark status={day.status ?? (day.date > data.date && day.kind === "rest" ? "rest" : null)} />
            </li>
          ))}
        </ul>
      </Card>
    </Screen>
  );
}
