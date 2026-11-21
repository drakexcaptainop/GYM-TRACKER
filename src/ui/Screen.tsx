import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Screen({ title, subtitle, action, children }: Props) {
  return (
    <main className="fade-in mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </main>
  );
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <p role="status" className="py-10 text-center text-muted">
      {label}
    </p>
  );
}

export function ErrorNote({ message = "No se pudo cargar. Revisa tu conexión e intenta de nuevo." }: { message?: string }) {
  return (
    <p role="alert" className="rounded-2xl border border-amber/40 bg-surface px-4 py-3 text-sm text-amber">
      {message}
    </p>
  );
}
