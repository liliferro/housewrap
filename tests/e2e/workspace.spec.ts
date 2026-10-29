import { fillAddress } from "./address-helper";
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
  await fillAddress(page);
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
  await page
    .getByRole("button", { name: "Ver lista de estimados", exact: true })
    .click();
  await expect(page.getByRole("cell", { name: "$3,000.00" })).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await expect(page.getByText("Aprobado", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Avances de obra", exact: true })
    .click();
  await page
    .getByLabel("¿En qué obra trabajaste?")
    .selectOption({ label: "Prueba QA" });
  await page
    .getByLabel("¿Qué hiciste")
    .fill("Muro norte completo, flashing pendiente.");
  await page.getByLabel("Nombre del trabajador").fill("Pedro QA");
  await page.getByLabel("Horas reportadas").fill("7.5");
  await page.getByLabel("Rollos utilizados").fill("2");
  await page.getByRole("button", { name: "Confirmar y enviar" }).click();
  await expect(page.getByRole("status")).toContainText("Avance recibido");
  await page.reload();
  await page
    .getByRole("button", { name: "Vista general", exact: true })
    .click();
  await expect(
    page
      .locator(".operation-card")
      .getByText("Muro norte completo, flashing pendiente."),
  ).toBeVisible();
  await page
    .locator(".operation-card")
    .getByRole("button", { name: /Prueba QA/ })
    .click();
  const dashboard = page.getByRole("dialog");
  await expect(
    dashboard.getByText("DASHBOARD DE OBRA", { exact: true }),
  ).toBeVisible();
  await expect(dashboard.getByText("Pedro QA", { exact: true })).toBeVisible();
  await expect(dashboard.locator(".project-stats")).toContainText("7.5 h");
  await dashboard
    .getByLabel("Presupuesto cotizado de esta obra")
    .selectOption({ index: 1 });
  await expect(dashboard.locator(".project-stats")).toContainText("$3,000.00");
  await dashboard
    .getByText("Actualizar avance y fechas", { exact: true })
    .click();
  await dashboard
    .getByLabel("Fecha y hora de inicio", { exact: true })
    .fill("2026-10-28T08:00");
  await dashboard
    .getByRole("button", { name: "Guardar avance", exact: true })
    .click();
  await expect(dashboard.getByRole("progressbar")).toHaveAttribute(
    "value",
    "0",
  );
  await page.reload();
  await expect(
    page.getByRole("dialog").getByRole("progressbar"),
  ).toHaveAttribute("value", "0");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
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
