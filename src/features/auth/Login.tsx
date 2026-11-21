import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/api.ts";
import type { Profile } from "../../lib/types.ts";
import { Button } from "../../ui/Button.tsx";
import { ErrorNote, Loading } from "../../ui/Screen.tsx";

const PIN_LENGTH = 6;

function PinDots({ filled }: { filled: number }) {
  return (
    <div className="my-6 flex justify-center gap-3" aria-label={`${filled} de ${PIN_LENGTH} dígitos`}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < filled ? "border-cyan bg-cyan" : "border-line"}`} />
      ))}
    </div>
  );
}

function PinPad({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const client = useQueryClient();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: (value: string) => api("/api/auth/login", { method: "POST", body: { profileId: profile.id, pin: value } }),
    onSuccess: () => client.invalidateQueries(),
    onError: (error) => {
      setPin("");
      if (error instanceof ApiError && error.code === "locked") {
        const wait = Number(error.data.retryAfterSeconds ?? 30);
        setMessage(`Demasiados intentos. Espera ${wait} segundos e intenta de nuevo.`);
      } else if (error instanceof ApiError && error.code === "invalid_credentials") {
        const wait = Number(error.data.retryAfterSeconds ?? 0);
        setMessage(wait ? `PIN incorrecto. Espera ${wait} segundos para intentar otra vez.` : "PIN incorrecto.");
      } else {
        setMessage("No se pudo entrar. Revisa tu conexión.");
      }
    },
  });

  const press = (digit: string) => {
    if (login.isPending) return;
    setMessage(null);
    setPin((current) => {
      const next = (current + digit).slice(0, PIN_LENGTH);
      if (next.length === PIN_LENGTH) setTimeout(() => login.mutate(next), 0);
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fade-in mx-auto max-w-xs">
      <button type="button" onClick={onBack} className="mb-2 text-sm text-muted">
        ← Cambiar perfil
      </button>
      <h1 className="text-2xl font-bold">Hola, {profile.name}</h1>
      <p className="mt-1 text-muted">Ingresa tu PIN de {PIN_LENGTH} dígitos.</p>
      <PinDots filled={pin.length} />
      <p role="alert" className="mb-3 min-h-10 text-center text-sm text-amber">
        {message}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Button key={d} variant="secondary" size="lg" onClick={() => press(d)} aria-label={d}>
            {d}
          </Button>
        ))}
        <span />
        <Button variant="secondary" size="lg" onClick={() => press("0")} aria-label="0">
          0
        </Button>
        <Button variant="ghost" size="lg" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Borrar">
          ⌫
        </Button>
      </div>
    </div>
  );
}

export function Login() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: () => api<{ profiles: Profile[] }>("/api/profiles") });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      {profile ? (
        <PinPad profile={profile} onBack={() => setProfile(null)} />
      ) : (
        <div className="fade-in">
          <div className="bg-brand mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-on-accent" aria-hidden="true">
            <Dumbbell size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Gym Tracker</h1>
          <p className="mb-8 mt-2 text-muted">¿Quién entrena hoy?</p>
          {profiles.isPending && <Loading />}
          {profiles.isError && <ErrorNote />}
          <div className="flex flex-col gap-3">
            {profiles.data?.profiles.map((p) => (
              <Button key={p.id} variant="secondary" size="lg" block onClick={() => setProfile(p)}>
                {p.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
