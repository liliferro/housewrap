import { test, expect } from "@playwright/test";
import { fillAddress } from "./address-helper";
test("create worker, assign a new work, submit and approve hours for weekly payment", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Trabajadores", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuevo trabajador", exact: true })
    .click();
  await page
    .getByLabel("Nombre completo", { exact: true })
    .fill("Trabajador QA");
  await page.getByLabel("Correo de acceso").fill("worker@example.com");
  await page.getByLabel("Tarifa por hora (USD)", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Crear trabajador y acceso" }).click();
  await page.getByRole("button", { name: "Obras", exact: true }).click();
  await page.getByRole("button", { name: "Nueva obra", exact: true }).click();
  await page.getByLabel("Nombre de la obra").fill("Obra asignada QA");
  await page.getByLabel("Builder", { exact: true }).fill("Builder QA");
  await page
    .getByLabel("Persona de contacto", { exact: true })
    .fill("Contacto QA");
  await fillAddress(page);
  await page.getByRole("checkbox", { name: /Trabajador QA/ }).check();
  await page.getByRole("button", { name: "Crear obra", exact: true }).click();
  await page
    .getByRole("button", { name: "Avances de obra", exact: true })
    .click();
  await page
    .getByLabel("Trabajador de demostración")
    .selectOption({ label: "Trabajador QA" });
  await page
    .getByLabel("¿En qué obra trabajaste?")
    .selectOption({ label: "Obra asignada QA" });
  await expect(page.getByLabel("Nombre del trabajador")).toHaveValue(
    "Trabajador QA",
  );
  await expect(page.getByLabel("Nombre del trabajador")).toHaveAttribute(
    "readonly",
    "",
  );
  await page.getByLabel("¿Qué hiciste").fill("Trabajo de prueba terminado");
  await page.getByLabel("Horas reportadas").fill("4");
  await page.getByLabel("Rollos utilizados").fill("1");
  await page.getByRole("button", { name: "Confirmar y enviar" }).click();
  await expect(page.getByRole("status")).toContainText("Avance recibido");
  await page
    .getByRole("button", { name: "Revisar avances", exact: true })
    .click();
  await page.getByRole("button", { name: "Aprobar avance" }).click();
  await page.getByRole("button", { name: "Trabajadores", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "$100.00", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Trabajadores", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "$100.00", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
