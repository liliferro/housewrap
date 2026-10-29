import { fillAddress } from "./address-helper";
import { test, expect } from "@playwright/test";
test("create a work inside an estimate without losing values, including an empty workspace", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.evaluate(() =>
    localStorage.setItem(
      "qh-demo-v1",
      JSON.stringify({
        projects: [],
        builders: [],
        contacts: [],
        estimates: [],
        reports: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: /^Estimados/ }).click();
  await page
    .getByRole("button", { name: "Nuevo estimado", exact: true })
    .click();
  await page.getByLabel("Área bruta (ft²)", { exact: true }).fill("3000");
  await page.getByLabel("Tarifa por ft² (USD)", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "+ Crear nueva obra", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancelar nueva obra", exact: true })
    .click();
  await expect(
    page.getByLabel("Área bruta (ft²)", { exact: true }),
  ).toHaveValue("3000");
  await page
    .getByRole("button", { name: "+ Crear nueva obra", exact: true })
    .click();
  await page.getByLabel("Nombre de la obra").fill("Obra desde estimado");
  await page.getByLabel("Builder", { exact: true }).fill("Builder nuevo");
  await page
    .getByLabel("Persona de contacto", { exact: true })
    .fill("Laura QA");
  await page
    .getByLabel("Correo electrónico (opcional)")
    .fill("laura@example.com");
  await fillAddress(page);
  await page.getByLabel("Zona o sector (opcional)").fill("Marietta norte");
  await page
    .getByLabel("Tipo de proyecto", { exact: true })
    .selectOption("multi_family");
  await page
    .getByLabel("Tipo de trabajo", { exact: true })
    .selectOption("new_construction");
  await page.getByLabel("Prioridad", { exact: true }).selectOption("high");
  await page
    .getByLabel("Lote o unidad (opcional)", { exact: true })
    .fill("Lot 24 · Unidad B");
  await page
    .getByLabel("Inicio previsto (opcional)", { exact: true })
    .fill("2026-11-01");
  await page.getByLabel("Fecha objetivo", { exact: false }).fill("2026-11-10");
  await page
    .getByLabel("Notas de la obra (opcional)", { exact: true })
    .fill("Revisar flashing en ventanas del segundo piso.");
  await page
    .getByLabel("Acceso e indicaciones (opcional)", { exact: true })
    .fill("Entrada por calle lateral, desde las 8 am.");

  await page
    .getByRole("button", { name: "Crear obra y continuar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Preparar estimado" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Obra", { exact: true }).locator("option:checked"),
  ).toHaveText("Obra desde estimado");
  await expect(
    page.getByLabel("Área bruta (ft²)", { exact: true }),
  ).toHaveValue("3000");
  await expect(
    page.getByLabel("Tarifa por ft² (USD)", { exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "$6,000.00", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Estimados/ }).click();
  await expect(page.locator(".estimate-work-info")).toContainText(
    "Marietta norte",
  );
  await expect(page.locator(".estimate-work-info")).toContainText("Laura QA");
  await expect(
    page
      .locator(".estimate-work-info")
      .getByRole("link", { name: "laura@example.com" }),
  ).toHaveAttribute("href", "mailto:laura@example.com");
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("qh-demo-v1")!),
  );
  expect(data.projects).toHaveLength(1);
  expect(data.estimates).toHaveLength(1);
  expect(data.estimates[0].project_id).toBe(data.projects[0].id);
  expect(data.estimates[0].total).toBe(6000);
  expect(data.projects[0].project_type).toBe("multi_family");
  expect(data.projects[0].lot_unit).toBe("Lot 24 · Unidad B");
  expect(data.projects[0].zone).toBe("Marietta norte");
  await page.getByRole("button", { name: /Obra desde estimado/ }).click();
  const panel = page
    .getByRole("dialog")
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Ficha de la obra", exact: true }),
    });
  await expect(panel).toContainText("Residencial multifamiliar");
  await expect(panel).toContainText("Entrada por calle lateral");
  await panel
    .getByRole("button", { name: "Editar ficha de la obra", exact: true })
    .click();
  await panel
    .getByLabel("Notas de la obra (opcional)", { exact: true })
    .fill("Notas actualizadas desde el dashboard.");
  await panel
    .getByRole("button", { name: "Guardar ficha", exact: true })
    .click();
  await expect(
    panel.getByText("Notas actualizadas desde el dashboard.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Notas actualizadas desde el dashboard.", { exact: true }),
  ).toBeVisible();
});
