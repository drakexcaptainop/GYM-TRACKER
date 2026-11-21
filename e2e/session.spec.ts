import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, name: string, pin: string) {
  await page.goto("/");
  await page.getByRole("button", { name }).click();
  for (const digit of pin) await page.getByRole("button", { name: digit, exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
}

test("persona 1 entrena y persona 2 ve su día completado sin pesos", async ({ browser }) => {
  const ana = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  await login(ana, "Ana", "111111");

  // Una vez por semana el día puede ser descanso: se fuerza una sesión con lo que haya hoy.
  const start = ana.getByRole("button", { name: /Comenzar entrenamiento|Entrenar de todos modos/ });
  await expect(start).toBeVisible();
  await start.click();
  await expect(ana).toHaveURL(/entrenar/);

  // Calentamiento (si hoy toca): cada paso es "Hecho"; luego series.
  for (let guard = 0; guard < 80; guard++) {
    const finish = ana.getByRole("button", { name: "Finalizar entrenamiento" });
    if (await finish.isVisible()) break;
    const skipRest = ana.getByRole("button", { name: "Saltar", exact: true });
    if (await skipRest.isVisible()) {
      await skipRest.click();
      continue;
    }
    const done = ana.getByRole("button", { name: /Hecho|Completar serie/ });
    if (await done.isVisible()) await done.click();
  }
  await ana.getByRole("button", { name: "Finalizar entrenamiento" }).click();
  await expect(ana.getByText("¡Entrenamiento completado!")).toBeVisible();

  const luis = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  await login(luis, "Luis", "222222");
  await luis.getByRole("link", { name: "Nosotros" }).click();
  await expect(luis.getByText("Ana")).toBeVisible();
  await expect(luis.getByText("Hoy: entrenamiento completado").first()).toBeVisible();
  const body = await luis.locator("body").innerText();
  expect(body).not.toMatch(/\bkg\b/);
});
