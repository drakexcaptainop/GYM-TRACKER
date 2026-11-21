import { describe, expect, it } from "vitest";
import { currentStreak, type DayRow } from "../../shared/streak.ts";

// Filas de la mas reciente a la mas antigua.
const rows = (...s: DayRow["status"][]): DayRow[] => s.map((status, i) => ({ date: `d${i}`, status }));

describe("racha", () => {
  it("suma los completados seguidos", () => {
    expect(currentStreak(rows("completed", "completed", "completed"))).toBe(3);
  });

  it("los descansos programados no la rompen ni suman", () => {
    expect(currentStreak(rows("completed", "rest", "rest", "completed"))).toBe(2);
  });

  it("el primer pendiente la corta", () => {
    expect(currentStreak(rows("completed", "pending", "completed", "completed"))).toBe(1);
  });

  it("sin filas la racha es cero", () => {
    expect(currentStreak([])).toBe(0);
  });

  it("solo descansos da cero", () => {
    expect(currentStreak(rows("rest", "rest"))).toBe(0);
  });
});
