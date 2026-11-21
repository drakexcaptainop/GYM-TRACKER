import type { DayStatus } from "../lib/types.ts";

export const STATUS_LABEL: Record<DayStatus, string> = {
  completed: "Entrenamiento completado",
  pending: "Entrenamiento pendiente",
  rest: "Día de descanso programado",
};

interface Props {
  status: DayStatus | null;
  size?: number;
}

/**
 * Estado de un día. Se distingue por forma y por color, nunca con verde ni rojo:
 * completado = marca rellena cian, pendiente = aro ámbar, descanso = guion gris.
 */
export function StatusMark({ status, size = 24 }: Props) {
  if (status === null) {
    return <span aria-hidden="true" style={{ width: size, height: size }} className="inline-block rounded-full border border-dashed border-line" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={STATUS_LABEL[status]} data-status={status}>
      {status === "completed" && (
        <>
          <circle cx="12" cy="12" r="11" fill="var(--cyan)" />
          <path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="var(--on-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {status === "pending" && <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--amber)" strokeWidth="3" />}
      {status === "rest" && <path d="M6 12h12" stroke="var(--muted)" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}
