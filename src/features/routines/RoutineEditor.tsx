import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api.ts";
import type { CatalogExercise, Routine, RoutineDay, RoutineItem } from "../../lib/types.ts";
import { Button } from "../../ui/Button.tsx";
import { Card, SectionTitle } from "../../ui/Card.tsx";
import { NumberField, SelectField, TextField, toNumber } from "../../ui/Field.tsx";
import { ErrorNote, Loading, Screen } from "../../ui/Screen.tsx";
import { Sheet } from "../../ui/Sheet.tsx";
import { WEEKDAYS, prescriptionText } from "../../ui/format.ts";

function ItemForm({ item, onSave }: { item: RoutineItem; onSave: (body: Record<string, unknown>) => void }) {
  const [sets, setSets] = useState(item.sets?.toString() ?? "");
  const [min, setMin] = useState(item.targetMin?.toString() ?? "");
  const [max, setMax] = useState(item.targetMax?.toString() ?? "");
  const [weight, setWeight] = useState(item.weightKg?.toString() ?? "");
  const [rest, setRest] = useState(item.restSeconds?.toString() ?? "");
  const [role, setRole] = useState(item.role);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          sets: toNumber(sets),
          targetMin: toNumber(min),
          targetMax: toNumber(max),
          weightKg: toNumber(weight),
          restSeconds: toNumber(rest),
          role,
        });
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        <NumberField label="Series" value={sets} onChange={(e) => setSets(e.target.value)} />
        <NumberField label="Mín." value={min} onChange={(e) => setMin(e.target.value)} />
        <NumberField label="Máx." value={max} onChange={(e) => setMax(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Peso (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <NumberField label="Descanso (s)" value={rest} onChange={(e) => setRest(e.target.value)} />
      </div>
      <SelectField label="Tipo" value={role} onChange={(e) => setRole(e.target.value as RoutineItem["role"])}>
        <option value="main">Principal</option>
        <option value="accessory">Accesorio</option>
      </SelectField>
      <Button type="submit">Guardar</Button>
    </form>
  );
}

export function RoutineEditor() {
  const id = Number(useParams().id);
  const client = useQueryClient();
  const routine = useQuery({ queryKey: ["routine", id], queryFn: () => api<{ routine: Routine }>(`/api/routines/${id}`) });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => api<{ exercises: CatalogExercise[] }>("/api/exercises") });
  const [weekday, setWeekday] = useState(1);
  const [editing, setEditing] = useState<RoutineItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [name, setName] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["routine", id] }),
      client.invalidateQueries({ queryKey: ["routines"] }),
      client.invalidateQueries({ queryKey: ["home"] }),
    ]);

  const act = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }) =>
      api(`/api/routines/${id}${path}`, { method, body: body ?? {} }),
    onSuccess: refresh,
  });

  const createExercise = useMutation({
    mutationFn: (value: string) => api<{ id: number }>("/api/exercises", { method: "POST", body: { name: value } }),
    onSuccess: async (created) => {
      await client.invalidateQueries({ queryKey: ["catalog"] });
      setNewName("");
      act.mutate({ path: `/days/${weekday}/exercises`, method: "POST", body: { exerciseId: created.id, sets: 3 } });
      setAdding(false);
    },
  });

  if (routine.isPending) return <Loading />;
  if (routine.isError) return <Screen title="Rutina"><ErrorNote message="No se encontró la rutina." /></Screen>;
  const data = routine.data.routine;
  const day: RoutineDay | undefined = data.days.find((d) => d.weekday === weekday);
  const items = day?.exercises ?? [];

  const move = (index: number, delta: number) => {
    const ids = items.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    act.mutate({ path: `/days/${weekday}/order`, method: "PUT", body: { itemIds: ids } });
  };

  return (
    <Screen title={data.name} subtitle="Los cambios aplican a entrenamientos futuros.">
      <Link to="/rutinas" className="mb-3 inline-block text-sm text-muted">
        ← Mis rutinas
      </Link>

      <Card className="mb-4">
        <TextField label="Nombre" value={name ?? data.name} onChange={(e) => setName(e.target.value)} />
        {name !== null && name.trim() && name !== data.name && (
          <Button className="mt-3" onClick={() => act.mutate({ path: "", method: "PATCH", body: { name: name.trim() } }, { onSuccess: () => setName(null) })}>
            Guardar nombre
          </Button>
        )}
      </Card>

      <div role="tablist" aria-label="Días" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {WEEKDAYS.map((label, i) => (
          <button
            key={label}
            role="tab"
            aria-selected={weekday === i + 1}
            onClick={() => setWeekday(i + 1)}
            className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm ${weekday === i + 1 ? "bg-brand font-semibold text-on-accent" : "border border-line bg-surface text-muted"}`}
          >
            {label.slice(0, 3)}
          </button>
        ))}
      </div>

      {day && (
        <Card className="mb-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Tipo de día"
              value={day.kind}
              onChange={(e) => act.mutate({ path: `/days/${weekday}`, method: "PATCH", body: { kind: e.target.value } })}
            >
              <option value="session">Entrenamiento</option>
              <option value="rest">Descanso</option>
            </SelectField>
            <SelectField
              label="Calentamiento"
              value={day.warmupEnabled ? "1" : "0"}
              onChange={(e) => act.mutate({ path: `/days/${weekday}`, method: "PATCH", body: { warmupEnabled: e.target.value === "1" } })}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </SelectField>
          </div>
        </Card>
      )}

      <SectionTitle>{day?.title || WEEKDAYS[weekday - 1]}</SectionTitle>
      {items.length === 0 && <p className="text-sm text-muted">Sin ejercicios este día.</p>}
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={item.id}>
            <Card className="flex items-center gap-2">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(item)}>
                <p className="truncate font-semibold">{item.name}</p>
                <p className="text-sm text-muted">
                  {prescriptionText(item)}
                  {item.weightKg ? ` · ${item.weightKg} kg` : ""}
                </p>
              </button>
              <button aria-label="Subir" className="p-2 text-muted" onClick={() => move(index, -1)} disabled={index === 0}>
                <ArrowUp size={20} />
              </button>
              <button aria-label="Bajar" className="p-2 text-muted" onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                <ArrowDown size={20} />
              </button>
              <button
                aria-label={`Quitar ${item.name}`}
                className="p-2 text-muted"
                onClick={() => act.mutate({ path: `/days/${weekday}/exercises/${item.id}`, method: "DELETE" })}
              >
                <Trash2 size={20} />
              </button>
            </Card>
          </li>
        ))}
      </ul>
      <Button className="mt-4" block variant="secondary" onClick={() => setAdding(true)}>
        Agregar ejercicio
      </Button>

      <Sheet open={editing !== null} title={editing?.name ?? ""} onClose={() => setEditing(null)}>
        {editing && (
          <ItemForm
            key={editing.id}
            item={editing}
            onSave={(body) => {
              act.mutate({ path: `/days/${weekday}/exercises/${editing.id}`, method: "PATCH", body });
              setEditing(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={adding} title="Agregar ejercicio" onClose={() => setAdding(false)}>
        <ul className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {catalog.data?.exercises.map((ex) => (
            <li key={ex.id}>
              <button
                className="min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-left"
                onClick={() => {
                  act.mutate({ path: `/days/${weekday}/exercises`, method: "POST", body: { exerciseId: ex.id, sets: 3 } });
                  setAdding(false);
                }}
              >
                {ex.name}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createExercise.mutate(newName.trim());
          }}
        >
          <TextField label="O crea uno nuevo" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" disabled={!newName.trim()}>
            Crear y agregar
          </Button>
        </form>
      </Sheet>
    </Screen>
  );
}
