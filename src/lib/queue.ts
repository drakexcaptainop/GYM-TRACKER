import { get, set } from "idb-keyval";
import { ApiError, api } from "./api.ts";

// Cola de escrituras pendientes: lo registrado sin conexión se guarda en IndexedDB y se envía en orden.
// Las escrituras de series son idempotentes en el servidor, así que reenviar nunca duplica.
export interface QueuedWrite {
  method: "POST" | "PUT" | "PATCH";
  path: string;
  body: unknown;
}

const KEY = "gt-write-queue";

// Toda lectura-modificación-escritura de la cola pasa por esta cadena, para que enqueue y flush
// no se pisen entre sí (dos escrituras seguidas, o una durante el envío, no se pierden).
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}

async function read(): Promise<QueuedWrite[]> {
  try {
    return ((await get(KEY)) as QueuedWrite[] | undefined) ?? [];
  } catch {
    return [];
  }
}

async function write(queue: QueuedWrite[]): Promise<void> {
  try {
    await set(KEY, queue);
  } catch {
    /* sin almacenamiento local: se intenta enviar igual */
  }
}

export async function pendingCount(): Promise<number> {
  return (await read()).length;
}

// Un rechazo definitivo (la petición está mal o el recurso no existe) se descarta;
// lo transitorio (sin red, error del servidor, demasiadas peticiones, sesión caducada) se conserva.
function isTransient(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status >= 500 || error.status === 401 || [408, 425, 429].includes(error.status);
}

let flushing: Promise<boolean> | null = null;

/** Envía en orden lo pendiente. Devuelve true cuando la cola quedó vacía. */
export function flushQueue(): Promise<boolean> {
  if (flushing) return flushing;
  flushing = (async () => {
    for (;;) {
      const next = (await read())[0];
      if (!next) return true;
      try {
        await api(next.path, { method: next.method, body: next.body });
      } catch (error) {
        if (isTransient(error)) return false;
      }
      await exclusive(async () => write((await read()).slice(1)));
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function enqueue(item: QueuedWrite): Promise<void> {
  await exclusive(async () => write([...(await read()), item]));
  void flushQueue();
}
