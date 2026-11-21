import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.ts";
import type { Profile, RoutineListItem } from "../../lib/types.ts";
import { Button } from "../../ui/Button.tsx";
import { Card, SectionTitle } from "../../ui/Card.tsx";
import { TextField } from "../../ui/Field.tsx";
import { ErrorNote, Loading, Screen } from "../../ui/Screen.tsx";
import { Sheet } from "../../ui/Sheet.tsx";

export function RoutinesScreen({ profile }: { profile: Profile }) {
  const client = useQueryClient();
  const list = useQuery({ queryKey: ["routines"], queryFn: () => api<{ routines: RoutineListItem[] }>("/api/routines") });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["routines"] }),
      client.invalidateQueries({ queryKey: ["routine"] }),
      client.invalidateQueries({ queryKey: ["home"] }),
    ]);
  };

  const run = useMutation({
    mutationFn: ({ path, method = "POST", body }: { path: string; method?: "POST" | "DELETE"; body?: unknown }) =>
      api(path, { method, body: body ?? {} }),
    onSuccess: refresh,
    onError: () => setNotice("No se pudo completar la acción. Intenta de nuevo."),
  });

  const create = useMutation({
    mutationFn: (value: string) => api<{ id: number }>("/api/routines", { method: "POST", body: { name: value } }),
    onSuccess: async () => {
      setCreating(false);
      setName("");
      await refresh();
    },
  });

  const logout = useMutation({
    mutationFn: () => api("/api/auth/logout", { method: "POST", body: {} }),
    onSuccess: () => {
      client.clear();
      client.setQueryData(["me"], null);
    },
  });

  const routines = list.data?.routines ?? [];

  return (
    <Screen title="Mis rutinas" subtitle="Cada cambio vale para los próximos entrenamientos; tu historial no se toca.">
      {list.isPending && <Loading />}
      {list.isError && <ErrorNote />}
      {notice && <ErrorNote message={notice} />}

      <div className="flex flex-col gap-3">
        {routines.map((r) => (
          <Card key={r.id} className={r.isActive ? "border-cyan/60" : ""}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link to={`/rutinas/${r.id}`} className="text-lg font-bold">
                  {r.name}
                </Link>
                {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
              </div>
              {r.isActive && <span className="rounded-full bg-cyan px-3 py-1 text-xs font-semibold text-on-accent">Activa</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={`/rutinas/${r.id}`} className="flex min-h-11 items-center rounded-2xl border border-line bg-surface-2 px-4 text-sm">
                Editar
              </Link>
              {r.isActive ? (
                <Button variant="secondary" onClick={() => run.mutate({ path: `/api/routines/${r.id}/deactivate` })}>
                  Desactivar
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => run.mutate({ path: `/api/routines/${r.id}/activate` })}>
                  Activar
                </Button>
              )}
              <Button variant="secondary" onClick={() => run.mutate({ path: `/api/routines/${r.id}/duplicate` })}>
                Duplicar
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (r.isActive) {
                    setNotice("Activa otra rutina antes de eliminar esta, para no quedarte sin rutina.");
                    return;
                  }
                  if (window.confirm(`¿Eliminar la rutina “${r.name}”? Tu historial se conserva.`)) {
                    setNotice(null);
                    run.mutate({ path: `/api/routines/${r.id}`, method: "DELETE" });
                  }
                }}
              >
                Eliminar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Button className="mt-4" block variant="primary" onClick={() => setCreating(true)}>
        Crear rutina desde cero
      </Button>

      <SectionTitle>Perfil</SectionTitle>
      <Card className="flex items-center justify-between gap-3">
        <p>
          Sesión de <span className="font-semibold">{profile.name}</span>
        </p>
        <Button variant="secondary" onClick={() => logout.mutate()}>
          Cerrar sesión
        </Button>
      </Card>

      <Sheet open={creating} title="Nueva rutina" onClose={() => setCreating(false)}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
        >
          <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Por ejemplo, Rutina de verano" autoFocus />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            Crear
          </Button>
        </form>
      </Sheet>
    </Screen>
  );
}
