import { test, expect } from "@playwright/test";
test("create a project, calculate an estimate, report and retain the data", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.getByText("Demostración · Datos de ejemplo")).toBeVisible();
  await page.getByRole("button", { name: "Nueva obra" }).click();
  await page.getByLabel("Nombre de la obra").fill("Prueba QA");
  await page.getByLabel("Builder", { exact: true }).fill("Builder QA");
  await page.getByLabel("Persona de contacto", { exact: true }).fill("Ana QA");
  await page.getByLabel("Dirección de la obra").fill("Atlanta GA");
  await page.getByRole("button", { name: "Crear obra", exact: true }).click();
  await expect(page.getByRole("button", { name: /Prueba QA/ })).toBeVisible();
  await page.getByRole("button", { name: "Estimados", exact: true }).click();
  await page.getByRole("button", { name: "Nuevo estimado" }).click();
  await page
    .getByLabel("Obra", { exact: true })
    .selectOption({ label: "Prueba QA" });
  await expect(page.getByText("$3,000.00", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(page.getByRole("cell", { name: "$3,000.00" })).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await expect(page.getByText("Aprobado", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Reportes de campo", exact: true })
    .click();
  await page
    .getByLabel("¿En qué obra trabajaste?")
    .selectOption({ label: "Prueba QA" });
  await page
    .getByLabel("¿Qué hiciste")
    .fill("Muro norte completo, flashing pendiente.");
  await page.getByLabel("Horas reportadas").fill("7.5");
  await page.getByLabel("Rollos utilizados").fill("2");
  await page.getByRole("button", { name: "Confirmar y enviar" }).click();
  await expect(page.getByRole("status")).toContainText("Reporte recibido");
  await page.reload();
  await page
    .getByRole("button", { name: "Vista general", exact: true })
    .click();
  await expect(
    page.getByText("Muro norte completo, flashing pendiente."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("unauthenticated production route is gated", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});
