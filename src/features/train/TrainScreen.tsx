import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, set as idbSet, del } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.ts";
import { enqueue, flushQueue } from "../../lib/queue.ts";
import type { Guide, Session, SessionExercise, SessionSummary } from "../../lib/types.ts";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { NumberField, toNumber } from "../../ui/Field.tsx";
import { ErrorNote, Loading, Screen } from "../../ui/Screen.tsx";
import { Sheet } from "../../ui/Sheet.tsx";
import { clock, measureUnit, prescriptionText } from "../../ui/format.ts";
import { useStartSession } from "../home/HomeScreen.tsx";
import { advance, extendRest, pauseRest, remainingMs, resumePosition, resumeRest, setsFor, type Position, type Rest } from "./progress.ts";

const restKey = (id: string) => `gt-rest-${id}`;

function GuideView({ guide }: { guide: Guide | undefined }) {
  if (!guide) return <p className="text-muted">Esta guía todavía no está disponible.</p>;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {guide.muscles && <p><span className="font-semibold">Músculos: </span>{guide.muscles}</p>}
      {guide.materials && <p><span className="font-semibold">Material: </span>{guide.materials}</p>}
      <ol className="list-decimal space-y-1 pl-5">
        {guide.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      {guide.tips && <p><span className="font-semibold">Consejo: </span>{guide.tips}</p>}
      {guide.mistakes && <p><span className="font-semibold">Evita: </span>{guide.mistakes}</p>}
    </div>
  );
}

function Guided({ initial }: { initial: Session }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<SessionExercise[]>(initial.exercises);
  const [position, setPosition] = useState<Position | null>(() => resumePosition(initial.exercises));
  const [rest, setRest] = useState<Rest | null>(null);
  const [now, setNow] = useState(Date.now());
  const [value, setValue] = useState("");
  const [weight, setWeight] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [paused, setPaused] = useState(initial.status === "paused");

  const current = position ? exercises[position.exercise] : undefined;

  // Recupera el descanso en curso si se recargó la pantalla.
  useEffect(() => {
    void get(restKey(initial.id)).then((saved) => saved && setRest(saved as Rest)).catch(() => {});
  }, [initial.id]);

  const saveRest = useCallback(
    (next: Rest | null) => {
      setRest(next);
      void (next ? idbSet(restKey(initial.id), next) : del(restKey(initial.id))).catch(() => {});
    },
    [initial.id],
  );

  useEffect(() => {
    if (!rest) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [rest]);

  // Valores sugeridos al cambiar de serie: lo planeado, o lo último registrado.
  useEffect(() => {
    if (!current) return;
    const last = [...current.sets].reverse().find((s) => s.kind === "work");
    setValue(String(last?.value ?? current.targetMax ?? current.targetMin ?? ""));
    setWeight(String(last?.weightKg ?? current.weightPlanned ?? ""));
  }, [position?.exercise, position?.set]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (method: "PUT" | "POST" | "PATCH", path: string, body: unknown) => enqueue({ method, path, body });

  const finish = async () => {
    setFinishing(true);
    setFinishError(null);
    // Si algo quedó sin enviar, terminar ahora lo rechazaría como "sesión cerrada": se avisa y se reintenta después.
    if (!(await flushQueue())) {
      setFinishError("Hay series sin enviar. Revisa tu conexión e intenta de nuevo.");
      setFinishing(false);
      return;
    }
    try {
      const done = await api<{ summary: SessionSummary }>(`/api/sessions/${initial.id}/finish`, { method: "POST", body: {} });
      setSummary(done.summary);
      saveRest(null);
      // La sesión actual se deja como está para que el resumen siga en pantalla; se limpia al volver al inicio.
      await client.invalidateQueries({ predicate: (q) => q.queryKey[1] !== "current" });
    } catch {
      setFinishError("No se pudo terminar. Intenta de nuevo.");
      setFinishing(false);
    }
  };

  const completeSet = () => {
    if (!position || !current) return;
    if (current.kind === "exercise") {
      const entry = { kind: "work" as const, setNumber: position.set, value: toNumber(value), weightKg: toNumber(weight) };
      send("PUT", `/api/sessions/${initial.id}/sets`, { sessionExerciseId: current.id, ...entry });
      setExercises((all) =>
        all.map((e) => (e.id === current.id ? { ...e, sets: [...e.sets.filter((s) => !(s.kind === "work" && s.setNumber === position.set)), entry] } : e)),
      );
    }
    const { next, exerciseDone } = advance(exercises, position);
    if (exerciseDone) {
      send("PUT", `/api/sessions/${initial.id}/exercises/${current.id}/done`, { done: true });
      setExercises((all) => all.map((e) => (e.id === current.id ? { ...e, done: true } : e)));
    }
    setPosition(next);
    if (next && current.kind === "exercise" && (current.restSeconds ?? 0) > 0) {
      saveRest({ until: Date.now() + current.restSeconds! * 1000, pausedLeft: null });
      setNow(Date.now());
    }
  };

  const skipExercise = () => {
    if (!position || !current) return;
    send("PUT", `/api/sessions/${initial.id}/exercises/${current.id}/done`, { done: true });
    setExercises((all) => all.map((e) => (e.id === current.id ? { ...e, done: true } : e)));
    const nextIndex = position.exercise + 1;
    setPosition(nextIndex < exercises.length ? { exercise: nextIndex, set: 1 } : null);
    saveRest(null);
  };

  const setStatus = (status: "paused" | "in_progress") => {
    setPaused(status === "paused");
    send("PATCH", `/api/sessions/${initial.id}`, { status, position: position ? JSON.stringify(position) : null });
  };

  if (summary) {
    return (
      <Screen title="¡Entrenamiento completado!" subtitle={initial.dayTitle}>
        <Card className="mb-4 grid grid-cols-2 gap-4 text-center">
          <div><p className="text-3xl font-bold text-cyan">{summary.exercisesCompleted}/{summary.exercisesPlanned}</p><p className="text-xs text-muted">ejercicios</p></div>
          <div><p className="text-3xl font-bold text-cyan">{summary.setsDone}</p><p className="text-xs text-muted">series</p></div>
          <div><p className="text-3xl font-bold text-cyan">{summary.totalReps}</p><p className="text-xs text-muted">repeticiones</p></div>
          <div><p className="text-3xl font-bold text-cyan">{summary.durationSeconds ? Math.max(1, Math.round(summary.durationSeconds / 60)) : "–"}</p><p className="text-xs text-muted">minutos</p></div>
        </Card>
        <Button
          block
          size="lg"
          onClick={() => {
            client.setQueryData(["session", "current"], { session: null });
            navigate("/");
          }}
        >
          Volver al inicio
        </Button>
      </Screen>
    );
  }

  const left = rest ? remainingMs(rest, now) : 0;
  const resting = rest !== null;
  const total = exercises.length;
  const doneCount = exercises.filter((e) => e.done).length;

  if (!position || !current) {
    return (
      <Screen title="¡Terminaste!" subtitle={`${doneCount} de ${total} ejercicios`}>
        <Button block size="lg" disabled={finishing} onClick={finish}>Finalizar entrenamiento</Button>
        {finishError && <p role="alert" className="mt-3 text-sm text-amber">{finishError}</p>}
      </Screen>
    );
  }

  const isWarmup = current.kind === "warmup";
  return (
    <Screen title={current.name} subtitle={`Paso ${position.exercise + 1} de ${total} · ${initial.dayTitle}`}>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="bg-brand h-full" style={{ width: `${(doneCount / total) * 100}%` }} />
      </div>

      {paused ? (
        <Card className="text-center">
          <p className="mb-4 text-lg font-semibold">Entrenamiento en pausa</p>
          <Button block size="lg" onClick={() => setStatus("in_progress")}>Retomar</Button>
        </Card>
      ) : resting ? (
        <Card className="text-center" aria-live="polite">
          <p className="text-sm uppercase tracking-wider text-muted">Descanso</p>
          <p className="my-3 text-6xl font-bold tabular-nums text-cyan" role="timer">{clock(Math.ceil(left / 1000))}</p>
          {left === 0 && <p className="mb-3 text-amber">Listo para la siguiente serie</p>}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={() => saveRest(extendRest(rest!, 15))}>+15 s</Button>
            <Button variant="secondary" onClick={() => saveRest(rest!.pausedLeft === null ? pauseRest(rest!, Date.now()) : resumeRest(rest!, Date.now()))}>
              {rest!.pausedLeft === null ? "Pausar" : "Seguir"}
            </Button>
            <Button variant="primary" onClick={() => saveRest(null)}>Saltar</Button>
          </div>
          <p className="mt-4 text-sm text-muted">Siguiente: {current.name}, serie {position.set} de {setsFor(current)}</p>
        </Card>
      ) : (
        <Card>
          <p className="text-lg font-semibold">
            {isWarmup ? "Calentamiento" : `Serie ${position.set} de ${setsFor(current)}`}
          </p>
          <p className="mt-1 text-muted">{isWarmup ? current.detail : prescriptionText({ sets: current.setsPlanned, targetMin: current.targetMin, targetMax: current.targetMax, measure: current.measure })}</p>
          {!isWarmup && current.measure !== "none" && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <NumberField label={measureUnit(current.measure)} value={value} onChange={(e) => setValue(e.target.value)} />
              <NumberField label="Peso (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          )}
          <Button className="mt-4" block size="lg" onClick={completeSet}>
            {isWarmup ? "Hecho" : "Completar serie"}
          </Button>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setShowGuide(true)}>Ver guía</Button>
        <Button variant="secondary" onClick={skipExercise}>Saltar ejercicio</Button>
        {!paused && <Button variant="ghost" onClick={() => setStatus("paused")}>Pausar</Button>}
        <Button variant="ghost" disabled={finishing} onClick={finish}>Terminar ahora</Button>
      </div>
      {finishError && <p role="alert" className="mt-3 text-sm text-amber">{finishError}</p>}

      <Sheet open={showGuide} title={current.name} onClose={() => setShowGuide(false)}>
        <GuideView guide={current.exerciseId ? initial.guides[current.exerciseId] : undefined} />
      </Sheet>
    </Screen>
  );
}

export function TrainScreen() {
  const { start, error } = useStartSession();
  const session = useQuery({
    queryKey: ["session", "current"],
    queryFn: async () => {
      await flushQueue();
      return api<{ session: Session | null }>("/api/sessions/current");
    },
    staleTime: 0,
  });

  if (session.isPending) return <Loading />;
  if (session.isError) return <Screen title="Entrenar"><ErrorNote /></Screen>;
  const data = session.data.session;
  if (!data) {
    return (
      <Screen title="Entrenar" subtitle="Sigue tu rutina paso a paso.">
        <Card className="text-center">
          <p className="mb-4 text-muted">No hay un entrenamiento en curso.</p>
          <Button block size="lg" disabled={start.isPending} onClick={() => start.mutate()}>Comenzar entrenamiento de hoy</Button>
          {error && <p role="alert" className="mt-3 text-sm text-amber">{error}</p>}
        </Card>
      </Screen>
    );
  }
  return <Guided key={data.id} initial={data} />;
}
