import { describe, expect, it } from "vitest";
import { addDays, dateRange, localDate, startOfWeek, weekdayOf } from "../../shared/dates.ts";

describe("fechas en La Paz", () => {
  it("usa UTC-4: las 02:00 UTC siguen siendo el dia anterior", () => {
    expect(localDate(Date.UTC(2026, 10, 21, 2, 0))).toBe("2026-11-20");
    expect(localDate(Date.UTC(2026, 10, 21, 4, 0))).toBe("2026-11-21");
  });

  it("calcula el dia de la semana con lunes = 1 y domingo = 7", () => {
    expect(weekdayOf("2026-11-16")).toBe(1);
    expect(weekdayOf("2026-11-22")).toBe(7);
  });

  it("suma dias cruzando mes y año", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("el inicio de semana es el lunes", () => {
    expect(startOfWeek("2026-11-21")).toBe("2026-11-16");
    expect(startOfWeek("2026-11-16")).toBe("2026-11-16");
  });

  it("rango inclusivo, vacio si el inicio pasa al final", () => {
    expect(dateRange("2026-11-01", "2026-11-03")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(dateRange("2026-11-04", "2026-11-03")).toEqual([]);
  });
});
