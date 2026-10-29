import { test, expect } from "@playwright/test";
import { demoData } from "../../src/lib/model";
test("pipeline moves a work through stages and persists without counting revisions twice", async ({
  page,
}) => {
  const d = demoData();
  d.projects = d.projects.slice(0, 1);
  const base = {
    project_id: d.projects[0].id,
    area: 1000,
    rate: 1,
    waste: 0,
    roll_size: 1000,
    rolls: 1,
    status: "approved" as const,
  };
  d.estimates = [
    { ...base, id: "a", total: 1000, created_at: "2026-10-01" },
    { ...base, id: "b", total: 2000, created_at: "2026-10-02" },
  ];
  await page.goto("/demo");
  await page.evaluate(
    (d) => localStorage.setItem("qh-demo-v1", JSON.stringify(d)),
    d,
  );
  await page.reload();
  await page.getByRole("button", { name: "Estimados", exact: true }).click();
  await expect(page.locator(".stage-quoted")).toContainText("$2,000.00");
  await expect(page.locator(".pipeline-card")).toHaveCount(1);
  for (const stage of [
    "received",
    "to_quote",
    "quoted",
    "sent",
    "reminder_1",
    "reminder_2",
    "won",
    "lost",
  ]) {
    await page
      .getByLabel("Etapa de Oakview · Lot 14", { exact: true })
      .selectOption(stage);
    await expect(page.locator(`.stage-${stage} .pipeline-card`)).toHaveCount(1);
  }
  await expect(page.locator(".pipeline-stats article").first()).toContainText(
    "$0.00",
  );
  await page.reload();
  await page.getByRole("button", { name: "Estimados", exact: true }).click();
  await expect(page.locator(".stage-lost .pipeline-card")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
