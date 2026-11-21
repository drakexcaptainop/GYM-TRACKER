import { beforeEach, describe, expect, it } from "vitest";
import { call, loginAs, setupProfiles } from "./helpers.ts";

let ana: string;
let luis: string;

beforeEach(async () => {
  await setupProfiles("all");
  ana = await loginAs(1);
  luis = await loginAs(2);
});

const json = async (res: Response) => (await res.json()) as any;
const send = (method: string, path: string, cookie: string, body?: unknown) =>
  call(path, { method, cookie, body: body === undefined ? undefined : JSON.stringify(body) });

const guideBody = { muscles: "Bíceps", materials: "Botellas", steps: ["Sube", "Baja"], tips: "t", mistakes: "m" };

describe("ejercicios y guías", () => {
  it("el catálogo trae los 33 ejercicios iniciales", async () => {
    const { exercises } = await json(await call("/api/exercises", { cookie: ana }));
    expect(exercises).toHaveLength(33);
    expect(exercises.every((e: { own: boolean }) => !e.own)).toBe(true);
  });

  it("editar la guía de un ejercicio base como persona 1 no cambia la guía de la persona 2", async () => {
    const { exercises } = await json(await call("/api/exercises", { cookie: ana }));
    const curl = exercises.find((e: { name: string }) => e.name === "Curl de bíceps").id;
    const before = await json(await call(`/api/exercises/${curl}`, { cookie: luis }));

    expect((await send("PUT", `/api/exercises/${curl}/guide`, ana, guideBody)).status).toBe(200);

    const mine = await json(await call(`/api/exercises/${curl}`, { cookie: ana }));
    expect(mine.guide.steps).toEqual(["Sube", "Baja"]);
    expect((await json(await call(`/api/exercises/${curl}`, { cookie: luis }))).guide).toEqual(before.guide);
  });

  it("editar la guía dos veces actualiza la misma copia", async () => {
    const { exercises } = await json(await call("/api/exercises", { cookie: ana }));
    const id = exercises[0].id;
    await send("PUT", `/api/exercises/${id}/guide`, ana, guideBody);
    await send("PUT", `/api/exercises/${id}/guide`, ana, { ...guideBody, tips: "nuevo" });
    expect((await json(await call(`/api/exercises/${id}`, { cookie: ana }))).guide.tips).toBe("nuevo");
  });

  it("un ejercicio propio sin guía se guarda y luego se completa por escrito", async () => {
    const created = await json(await send("POST", "/api/exercises", ana, { name: "Burpees", measure: "reps" }));
    expect(created.id).toBeGreaterThan(33);
    expect((await json(await call(`/api/exercises/${created.id}`, { cookie: ana }))).guide).toBeNull();
    await send("PUT", `/api/exercises/${created.id}/guide`, ana, guideBody);
    expect((await json(await call(`/api/exercises/${created.id}`, { cookie: ana }))).guide.steps).toHaveLength(2);
  });

  it("los ejercicios propios son privados de quien los crea", async () => {
    const created = await json(await send("POST", "/api/exercises", ana, { name: "Burpees" }));
    expect((await call(`/api/exercises/${created.id}`, { cookie: luis })).status).toBe(404);
    const luisList = await json(await call("/api/exercises", { cookie: luis }));
    expect(luisList.exercises).toHaveLength(33);
    const anaList = await json(await call("/api/exercises", { cookie: ana }));
    expect(anaList.exercises).toHaveLength(34);
  });

  it("solo se puede renombrar o borrar un ejercicio propio, no uno base", async () => {
    const { exercises } = await json(await call("/api/exercises", { cookie: ana }));
    const base = exercises[0].id;
    expect((await send("PATCH", `/api/exercises/${base}`, ana, { name: "x" })).status).toBe(403);
    expect((await send("DELETE", `/api/exercises/${base}`, ana)).status).toBe(403);
    const own = (await json(await send("POST", "/api/exercises", ana, { name: "Burpees" }))).id;
    expect((await send("PATCH", `/api/exercises/${own}`, ana, { name: "Burpee" })).status).toBe(200);
    expect((await send("DELETE", `/api/exercises/${own}`, ana)).status).toBe(200);
  });

  it("crea un ejercicio propio con su guía en un solo paso", async () => {
    const created = await json(await send("POST", "/api/exercises", ana, { name: "Saltos", guide: guideBody }));
    expect((await json(await call(`/api/exercises/${created.id}`, { cookie: ana }))).guide.muscles).toBe("Bíceps");
  });

  it("rechaza datos inválidos", async () => {
    expect((await send("POST", "/api/exercises", ana, { name: "" })).status).toBe(400);
    expect((await send("POST", "/api/exercises", ana, { name: "x", measure: "metros" })).status).toBe(400);
  });
});
