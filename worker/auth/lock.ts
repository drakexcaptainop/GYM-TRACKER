// Bloqueo por perfil tras fallos seguidos, con espera creciente.

export const MAX_FAILURES = 5;
export const BASE_WAIT_MS = 30_000;
export const MAX_WAIT_MS = 15 * 60_000;

export function waitAfterFailures(failures: number): number {
  if (failures < MAX_FAILURES) return 0;
  return Math.min(MAX_WAIT_MS, BASE_WAIT_MS * 2 ** (failures - MAX_FAILURES));
}

export interface LockRow {
  failures: number;
  locked_until: number;
}

export function isLocked(row: LockRow | null, now: number): boolean {
  return !!row && row.locked_until > now;
}
