import { test, expect } from "@playwright/test";
import { demoData } from "../../src/lib/model";
test("operational overview shows per-work consumption, alerts and opens the work", async ({
  page,
}) => {
  const data = demoData();
  data.projects[0] = {
    ...data.projects[0],
    progress: 45,
    target_date: "2020-01-01",
    quoted_estimate_id: "quote",
  };
  data.reports = [
    {
      id: "report",
      project_id: data.projects[0].id,
      notes: "Muro norte terminado; falta fachada.",
      hours: 6.5,
      installed_area: 450,
      review_status: "approved",
      rolls: 4,
      created_at: new Date().toISOString(),
    },
  ];
  data.estimates = [
    {
      id: "quote",
      project_id: data.projects[0].id,
      status: "approved",
      rolls: 3,
      total: 1500,
      area: 1000,
      rate: 1.5,
      waste: 0,
      roll_size: 400,
      created_at: new Date().toISOString(),
    },
  ];
  await page.goto("/demo");
  await page.evaluate(
    (data) => localStorage.setItem("qh-demo-v1", JSON.stringify(data)),
    data,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Control de obras" }),
  ).toBeVisible();
  await expect(
    page.getByText("Consumo superior al estimado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Vencidas (1)", exact: true }).click();
  const card = page.locator(".operation-card");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("45% de avance");
  await expect(card).toContainText("6.5 h");
  await expect(card).toContainText("1 de exceso");
  await expect(card).toContainText("Muro norte terminado");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await card
    .getByRole("button", { name: "Oakview · Lot 14 →", exact: true })
    .click();
  await expect(
    page.getByText("DASHBOARD DE OBRA", { exact: true }),
  ).toBeVisible();
});
