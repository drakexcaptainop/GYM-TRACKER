import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => void store.set(k, v),
}));
const apiMock = vi.fn();
vi.mock("./api.ts", async () => {
  class ApiError extends Error {
    constructor(public status: number, public code: string) {
      super(code);
    }
  }
  return { ApiError, api: (...args: unknown[]) => apiMock(...args) };
});

const { enqueue, flushQueue, pendingCount } = await import("./queue.ts");
const { ApiError } = await import("./api.ts");

const w = (n: number) => ({ method: "PUT" as const, path: `/p/${n}`, body: { n } });

beforeEach(() => {
  store.clear();
  apiMock.mockReset();
});

describe("cola de escrituras", () => {
  it("envía en orden y queda vacía", async () => {
    apiMock.mockResolvedValue({});
    await enqueue(w(1));
    await enqueue(w(2));
    expect(await flushQueue()).toBe(true);
    expect(apiMock.mock.calls.map((c) => c[0])).toEqual(["/p/1", "/p/2"]);
    expect(await pendingCount()).toBe(0);
  });

  it("dos escrituras seguidas no se pierden aunque haya un envío en curso", async () => {
    let release!: () => void;
    apiMock.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    apiMock.mockResolvedValue({});
    const first = enqueue(w(1));
    await first;
    await vi.waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    await Promise.all([enqueue(w(2)), enqueue(w(3))]);
    release();
    await flushQueue();
    await vi.waitFor(async () => expect(await pendingCount()).toBe(0));
    expect(apiMock.mock.calls.map((c) => c[0])).toEqual(["/p/1", "/p/2", "/p/3"]);
  });

  it.each([0, 401, 408, 429, 500])("conserva la escritura ante un error transitorio (%i)", async (status) => {
    apiMock.mockRejectedValue(new ApiError(status, "x"));
    await enqueue(w(1));
    expect(await flushQueue()).toBe(false);
    expect(await pendingCount()).toBe(1);
  });

  it("descarta un rechazo definitivo y sigue con la siguiente", async () => {
    apiMock.mockRejectedValueOnce(new ApiError(409, "closed")).mockResolvedValue({});
    store.set("gt-write-queue", [w(1), w(2)]);
    expect(await flushQueue()).toBe(true);
    expect(apiMock.mock.calls.map((c) => c[0])).toEqual(["/p/1", "/p/2"]);
  });
});
