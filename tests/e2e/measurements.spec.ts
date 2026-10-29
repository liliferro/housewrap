import { test, expect } from "@playwright/test";
test("measure facades, save provenance and retain after reload", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Estimados", exact: true }).click();
  await page.getByRole("button", { name: "Nuevo estimado" }).click();
  await page
    .getByRole("button", { name: "Calcular desde medidas del plano" })
    .click();
  await page.getByLabel("Referencia del plano / revisión").fill("A201 QA");
  await page.getByLabel("Base / longitud del paño 1").fill("140");
  await page.getByLabel("Altura del paño 1").fill("18");
  await page.getByRole("button", { name: "Agregar paño" }).click();
  await page.getByLabel("Forma del paño 2").selectOption("triangle");
  await page.getByLabel("Base / longitud del paño 2").fill("30");
  await page.getByLabel("Altura del paño 2").fill("6");
  await page.getByLabel("Cantidad del paño 2").fill("2");
  await expect(
    page.getByRole("button", { name: "Aplicar medición al estimado" }),
  ).toBeDisabled();
  await page.getByLabel("Verifiqué cotas").check();
  await page
    .getByRole("button", { name: "Aplicar medición al estimado" })
    .click();
  await expect(
    page.getByLabel("Área bruta (ft²)", { exact: true }),
  ).toHaveValue("2700");
  await page.getByLabel("Reserva de material (%)").fill("10");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Estimados", exact: true }).click();
  await page.getByRole("button", { name: "Ver lista de estimados" }).click();
  await expect(page.getByRole("cell", { name: "$3,375.00" })).toBeVisible();
  await page.getByText("Ver medición del plano", { exact: true }).click();
  await expect(page.getByText(/Asistida · A201 QA/)).toBeVisible();
});
