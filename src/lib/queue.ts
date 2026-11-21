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
let flushing: Promise<void> | null = null;

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

export async function flushQueue(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    for (;;) {
      const queue = await read();
      const next = queue[0];
      if (!next) return;
      try {
        await api(next.path, { method: next.method, body: next.body });
      } catch (error) {
        // Sin conexión o error del servidor: se conserva y se reintenta luego. Un rechazo definitivo se descarta.
        if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500 || error.status === 401) return;
      }
      await write((await read()).slice(1));
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function enqueue(item: QueuedWrite): Promise<void> {
  await write([...(await read()), item]);
  void flushQueue();
}
