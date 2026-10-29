import { test, expect } from "@playwright/test";
import { demoData } from "../../src/lib/model";
test("office reviews advances, requires observations, persists decisions and updates pending count", async ({
  page,
}) => {
  const d = demoData();
  d.reports = [
    {
      id: "review-1",
      project_id: d.projects[0].id,
      notes: "Muro norte terminado",
      author_name: "Ana",
      hours: 4,
      rolls: 2,
      created_at: new Date().toISOString(),
    },
    {
      id: "review-2",
      project_id: d.projects[1].id,
      notes: "Fachada pendiente",
      author_name: "Pedro",
      hours: 2,
      rolls: 1,
      created_at: new Date().toISOString(),
    },
  ];
  await page.goto("/demo");
  await page.evaluate(
    (d) => localStorage.setItem("qh-demo-v1", JSON.stringify(d)),
    d,
  );
  await page.reload();
  await page.getByRole("button", { name: /Avances por revisar: 2/ }).click();
  const ana = page.locator(".review-card").filter({ hasText: "Ana" });
  await ana
    .getByRole("button", { name: "Aprobar avance", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Avance aprobado");
  const pedro = page.locator(".review-card").filter({ hasText: "Pedro" });
  await pedro
    .getByRole("button", { name: "Devolver con observaciones" })
    .click();
  await expect(pedro.getByRole("alert")).toContainText(
    "Escribe qué debe corregirse",
  );
  await pedro
    .getByLabel("Observación para Pedro")
    .fill("Adjunta fotos de las ventanas.");
  await pedro
    .getByRole("button", { name: "Devolver con observaciones" })
    .click();
  await expect(page.getByRole("status")).toContainText("devuelto");
  await page
    .getByRole("button", { name: "Con observaciones (1)", exact: true })
    .click();
  await expect(page.locator(".review-card")).toContainText(
    "Adjunta fotos de las ventanas.",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Avances por revisar: 0/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revisar avances", exact: true })
    .click();
  await page.getByRole("button", { name: "Aprobado (1)", exact: true }).click();
  await expect(page.locator(".review-card")).toContainText("Ana");
  const reports = await page.evaluate(
    () => JSON.parse(localStorage.getItem("qh-demo-v1")!).reports,
  );
  expect(reports[0].review_status).toBe("approved");
  expect(reports[1].review_status).toBe("observed");
  expect(reports[0].hours).toBe(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
