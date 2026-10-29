import { test, expect } from "@playwright/test";
test("installed area moves progress only after review approval", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.evaluate(() => {
    const id = "11111111-1111-4111-8111-111111111111";
    localStorage.setItem(
      "qh-demo-v1",
      JSON.stringify({
        projects: [
          {
            id,
            name: "Area QA",
            builder: "QA",
            address: "Atlanta, GA",
            status: "active",
            target_date: null,
            created_at: new Date().toISOString(),
          },
        ],
        estimates: [
          {
            id: "q",
            project_id: id,
            status: "approved",
            area: 2400,
            rate: 1,
            total: 2400,
            rolls: 2,
            roll_size: 1350,
            waste: 0,
            created_at: new Date().toISOString(),
          },
        ],
        reports: [],
        builders: [],
        contacts: [],
      }),
    );
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Avances de obra", exact: true })
    .click();
  await page
    .getByLabel("¿En qué obra trabajaste?")
    .selectOption({ label: "Area QA" });
  await page.getByLabel("Nombre del trabajador").fill("Area worker");
  await page.getByLabel("¿Qué hiciste").fill("Instalamos la fachada norte");
  await page.getByLabel("Área nueva instalada (ft²)").fill("600");
  await page.getByLabel("Horas reportadas").fill("2");
  await page.getByLabel("Rollos utilizados").fill("1");
  await page.getByRole("button", { name: "Confirmar y enviar" }).click();
  await expect(page.getByRole("status")).toContainText("Avance recibido");
  await page
    .getByRole("button", { name: "Vista general", exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Avance de Area QA" }),
  ).toHaveAttribute("value", "0");
  await page
    .getByRole("button", { name: "Revisar avances", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Área instalada: 600 ft²", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aprobar avance", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Vista general", exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Avance de Area QA" }),
  ).toHaveAttribute("value", "25");
  await page.reload();
  await expect(
    page.getByRole("progressbar", { name: "Avance de Area QA" }),
  ).toHaveAttribute("value", "25");
});
