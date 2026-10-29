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
  await page.getByRole("button", { name: "Estimados", exact: true }).click();
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
  await page.getByLabel("Dirección de la obra").fill("Atlanta GA");
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
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("qh-demo-v1")!),
  );
  expect(data.projects).toHaveLength(1);
  expect(data.estimates).toHaveLength(1);
  expect(data.estimates[0].project_id).toBe(data.projects[0].id);
  expect(data.estimates[0].total).toBe(6000);
});
