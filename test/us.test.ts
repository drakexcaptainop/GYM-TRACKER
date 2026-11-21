import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call, json, loginAs, noon, send, setupProfiles, trainToday } from "./helpers.ts";

const MON = "2026-11-02";
const TUE = "2026-11-03";

let ana: string;
let luis: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(noon(MON));
  await setupProfiles("all");
  ana = await loginAs(1);
  luis = await loginAs(2);
});

afterEach(() => vi.useRealTimers());

const us = async (cookie: string) => json(await call("/api/us", { cookie }));
const person = (data: any, id: number) => data.people.find((p: any) => p.id === id);

describe("Nosotros", () => {
  it("covers AE5: la otra persona ve solo estado, racha y sesiones de la semana, sin pesos ni ejercicios", async () => {
    await trainToday(ana, [{ exercise: "Hip thrust con mochila", value: 15, weightKg: 40 }]);
    const data = await us(luis);
    expect(Object.keys(person(data, 1)).sort()).toEqual(["calendar", "id", "isMe", "name", "sessionsThisWeek", "streak", "today"]);
    expect(person(data, 1)).toMatchObject({ name: "Ana", streak: 1, sessionsThisWeek: 1, today: "completed", isMe: false });
    const text = JSON.stringify(data);
    expect(text).not.toContain("Hip thrust");
    expect(text).not.toContain("weight");
    expect(text).not.toContain("Sentadilla");
  });

  it("covers AE7: al terminar una persona, la otra ve su día como completado", async () => {
    expect(person(await us(luis), 1).today).toBe("pending");
    await trainToday(ana);
    const data = await us(luis);
    const ana1 = person(data, 1);
    expect(ana1.today).toBe("completed");
    expect(ana1.calendar.find((d: any) => d.date === MON).status).toBe("completed");
  });

  it("cada persona se ve a sí misma marcada y con su propia racha", async () => {
    await trainToday(luis);
    const data = await us(luis);
    expect(person(data, 2)).toMatchObject({ isMe: true, streak: 1 });
    expect(person(data, 1)).toMatchObject({ isMe: false, streak: 0 });
  });

  it("el calendario distingue completado, pendiente y descanso para ambos perfiles", async () => {
    await trainToday(ana); // lunes
    vi.setSystemTime(noon("2026-11-09")); // el lunes siguiente: sabado y domingo pasaron en descanso
    const data = await us(luis);
    const statusOf = (id: number, date: string) => person(data, id).calendar.find((d: any) => d.date === date).status;
    expect(statusOf(1, MON)).toBe("completed");
    expect(statusOf(2, MON)).toBe("pending");
    expect(statusOf(1, TUE)).toBe("pending");
    expect(statusOf(1, "2026-11-07")).toBe("rest");
    expect(statusOf(2, "2026-11-08")).toBe("rest");
    expect(statusOf(1, "2026-11-15")).toBeNull(); // futuro
  });

  it("el calendario cubre cinco semanas de lunes a domingo", async () => {
    const calendar = person(await us(ana), 1).calendar as { date: string }[];
    expect(calendar).toHaveLength(35);
    expect(calendar[0]!.date).toBe("2026-10-05");
    expect(calendar[34]!.date).toBe("2026-11-08");
  });
});

describe("mensajes de ánimo", () => {
  it("se envía una frase a quien está pendiente y aparece solo en su bandeja", async () => {
    const res = await send("POST", "/api/messages", ana, { phraseKey: "tu-puedes" });
    expect(res.status).toBe(201);
    const luisInbox = (await us(luis)).messages;
    expect(luisInbox).toEqual([expect.objectContaining({ fromName: "Ana", key: "tu-puedes", text: "¡Tú puedes! 💪" })]);
    expect((await us(ana)).messages).toEqual([]);
  });

  it("se puede enviar también a quien ya entrenó", async () => {
    await trainToday(luis);
    expect((await send("POST", "/api/messages", ana, { phraseKey: "orgullo" })).status).toBe(201);
    expect((await us(luis)).messages).toHaveLength(1);
  });

  it("rechaza una frase que no está en la lista: no hay texto libre", async () => {
    expect((await send("POST", "/api/messages", ana, { phraseKey: "hola-escribo-lo-que-quiero" })).status).toBe(400);
    expect((await send("POST", "/api/messages", ana, { text: "hola" })).status).toBe(400);
    expect((await us(luis)).messages).toEqual([]);
  });

  it("la bandeja muestra primero lo más reciente y ofrece la lista de frases", async () => {
    await send("POST", "/api/messages", ana, { phraseKey: "vamos" });
    vi.setSystemTime(noon(MON) + 60_000);
    await send("POST", "/api/messages", ana, { phraseKey: "contigo" });
    const data = await us(luis);
    expect(data.messages.map((m: any) => m.key)).toEqual(["contigo", "vamos"]);
    expect(data.phrases.map((p: any) => p.key)).toEqual(["tu-puedes", "vamos", "contigo", "uno-mas", "orgullo"]);
  });

  it("pide iniciar sesión", async () => {
    expect((await call("/api/us")).status).toBe(401);
    expect((await send("POST", "/api/messages", "", { phraseKey: "vamos" })).status).toBe(401);
  });
});
