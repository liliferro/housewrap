import { test, expect } from "@playwright/test";
import { demoData } from "../../src/lib/model";
test("returned report can be corrected in project and then approved once", async ({
  page,
}) => {
  const d = demoData();
  const p = d.projects[0];
  d.estimates = [
    {
      id: "q",
      project_id: p.id,
      status: "approved",
      area: 1000,
      total: 1000,
      rate: 1,
      rolls: 1,
      roll_size: 1350,
      waste: 0,
      created_at: new Date().toISOString(),
    },
  ];
  d.reports = [
    {
      id: "r",
      project_id: p.id,
      author_name: "Worker QA",
      notes: "Necesita corregir",
      hours: 3,
      rolls: 1,
      installed_area: 100,
      review_status: "observed",
      review_note: "Aclarar superficie instalada",
      work_date: "2026-10-29",
      created_at: new Date().toISOString(),
    },
  ];
  await page.goto("/demo");
  await page.evaluate(
    (d) => localStorage.setItem("qh-demo-v1", JSON.stringify(d)),
    d,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Oakview · Lot 14 →", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Corregir y reenviar avance", { exact: true }).click();
  await dialog
    .getByLabel("Descripción corregida")
    .fill("Fachada norte medida y corregida");
  await dialog.getByLabel("Horas corregidas").fill("2");
  await dialog.getByLabel("Área instalada corregida (ft²)").fill("250");
  await dialog.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(
    dialog.getByText("Pendiente de revisión", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Área instalada: 250 ft²", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByText("Revisar y aprobar avance", { exact: true }).click();
  await page
    .getByRole("button", { name: "Aprobar avance", exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Avance de " + p.name }),
  ).toHaveAttribute("value", "25");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("qh-demo-v1")!).reports.length,
    ),
  ).toBe(1);
});
test("all navigation screens fit viewport without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo");
  for (const label of [
    "Vista general",
    "Trabajadores",
    "Builders y contactos",
    "Obras",
    "Estimados",
    "Avances de obra",
    "Revisar avances",
    "Configuración",
  ]) {
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      label,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
