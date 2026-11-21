import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]));

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function hue(hex: string): number {
  const [r, g, b] = [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe("tokens de color", () => {
  it("define la paleta esperada", () => {
    for (const name of ["bg", "surface", "surface-2", "line", "ink", "muted", "primary", "cyan", "amber", "on-accent"]) {
      expect(tokens[name], name).toBeDefined();
    }
  });

  it.each([
    ["ink", "bg"],
    ["ink", "surface"],
    ["ink", "surface-2"],
    ["muted", "bg"],
    ["muted", "surface"],
    ["muted", "surface-2"],
    ["primary", "bg"],
    ["primary", "surface"],
    ["cyan", "bg"],
    ["cyan", "surface"],
    ["amber", "bg"],
    ["amber", "surface"],
    ["on-accent", "primary"],
    ["on-accent", "cyan"],
    ["on-accent", "amber"],
  ])("el texto %s sobre %s cumple contraste 4,5:1", (fg, bg) => {
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("ningún color de la paleta es verde ni rojo", () => {
    for (const name of ["primary", "cyan", "amber", "ink", "muted"]) {
      const h = hue(tokens[name]!);
      const saturated = Math.max(...[1, 3, 5].map((i) => parseInt(tokens[name]!.slice(i, i + 2), 16))) -
        Math.min(...[1, 3, 5].map((i) => parseInt(tokens[name]!.slice(i, i + 2), 16))) > 40;
      if (!saturated) continue; // grises y blancos
      const isRed = h < 20 || h > 340;
      const isGreen = h > 75 && h < 165;
      expect(isRed || isGreen, `${name} (matiz ${Math.round(h)})`).toBe(false);
    }
  });

  it("el fondo es negro o gris muy oscuro", () => {
    expect(luminance(tokens["bg"]!)).toBeLessThan(0.01);
  });
});
