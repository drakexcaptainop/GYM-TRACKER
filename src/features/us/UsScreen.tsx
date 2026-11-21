import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api.ts";
import type { Us, UsPerson } from "../../lib/types.ts";
import { Button } from "../../ui/Button.tsx";
import { Card, SectionTitle } from "../../ui/Card.tsx";
import { ErrorNote, Loading, Screen } from "../../ui/Screen.tsx";
import { Sheet } from "../../ui/Sheet.tsx";
import { StatusMark, STATUS_LABEL } from "../../ui/StatusMark.tsx";
import { WEEKDAYS_SHORT } from "../../ui/format.ts";

function Calendar({ person }: { person: UsPerson }) {
  return (
    <div className="mt-3">
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] text-muted">
        {WEEKDAYS_SHORT.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 place-items-center gap-y-2">
        {person.calendar.map((d) => <StatusMark key={d.date} status={d.status} size={18} />)}
      </div>
    </div>
  );
}

export function UsScreen() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  // Mínimo 30 s entre consultas: no hay tiempo real, se actualiza al entrar o al refrescar.
  const us = useQuery({ queryKey: ["us"], queryFn: () => api<Us>("/api/us"), staleTime: 30_000 });
  const send = useMutation({
    mutationFn: (phraseKey: string) => api("/api/messages", { method: "POST", body: { phraseKey } }),
    onSuccess: () => {
      setSent(true);
      setOpen(false);
      void client.invalidateQueries({ queryKey: ["us"] });
    },
  });

  if (us.isPending) return <Loading />;
  if (us.isError) return <Screen title="Nosotros"><ErrorNote /></Screen>;
  const { people, phrases, messages } = us.data;
  const other = people.find((p) => !p.isMe);

  return (
    <Screen title="Nosotros" subtitle="Constancia compartida.">
      <div className="flex flex-col gap-3">
        {people.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{p.isMe ? `${p.name} (tú)` : p.name}</p>
                <p className="flex items-center gap-2 text-sm text-muted">
                  <StatusMark status={p.today} size={16} />
                  Hoy: {STATUS_LABEL[p.today].toLowerCase()}
                </p>
              </div>
              <div className="text-right">
                <p className="flex items-center justify-end gap-1 text-2xl font-bold"><Flame size={20} className="text-amber" aria-hidden="true" />{p.streak}</p>
                <p className="text-xs text-muted">{p.sessionsThisWeek} esta semana</p>
              </div>
            </div>
            <Calendar person={p} />
          </Card>
        ))}
      </div>

      {other && (
        <Button className="mt-4" block variant="primary" onClick={() => setOpen(true)}>
          Enviar ánimo a {other.name}
        </Button>
      )}
      {sent && <p role="status" className="mt-2 text-center text-sm text-cyan">¡Mensaje enviado!</p>}

      <SectionTitle>Mensajes para ti</SectionTitle>
      {messages.length === 0 && <p className="text-sm text-muted">Aún no tienes mensajes.</p>}
      <ul className="flex flex-col gap-2">
        {messages.map((m) => (
          <li key={m.id} className="rounded-2xl bg-surface px-4 py-3"><span className="text-xs text-muted">{m.fromName}</span><p>{m.text}</p></li>
        ))}
      </ul>

      <Sheet open={open} title="Elige un mensaje" onClose={() => setOpen(false)}>
        <ul className="flex flex-col gap-2">
          {phrases.map((ph) => (
            <li key={ph.key}>
              <Button variant="secondary" block disabled={send.isPending} onClick={() => send.mutate(ph.key)}>{ph.text}</Button>
            </li>
          ))}
        </ul>
      </Sheet>
    </Screen>
  );
}
