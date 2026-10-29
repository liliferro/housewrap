import { test, expect } from "@playwright/test";
import { testAddress } from "./address-helper";
test("address selection is required and editing invalidates it; outage has explicit pending path", async ({
  page,
}) => {
  await page.route("**/api/addresses?**", (route) =>
    route.fulfill({ json: { results: [testAddress] } }),
  );
  await page.goto("/demo");
  await page.getByRole("button", { name: "Nueva obra", exact: true }).click();
  const input = page.getByLabel("Dirección de la obra", { exact: true });
  await input.fill("225 Baker Street Atlanta");
  expect(
    await input.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(false);
  await expect(
    page.getByRole("option", { name: testAddress.label }),
  ).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue(testAddress.label);
  expect(
    await input.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: /Ver ubicación/ }),
  ).toHaveAttribute("href", /33\.7632675/);
  await input.fill("999 Wrong address");
  expect(
    await input.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(false);
  await page.unroute("**/api/addresses?**");
  await page.route("**/api/addresses?**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "El mapa no está disponible ahora." },
    }),
  );
  await input.fill("123 New Construction Atlanta");
  await expect(
    page.getByText("El mapa no está disponible ahora.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("La dirección no aparece: guardar pendiente de verificar")
    .check();
  await page
    .getByLabel("Motivo de dirección pendiente")
    .fill("Obra nueva, confirmar número con builder.");
  await page.getByLabel("Nombre de la obra").fill("Obra nueva sin mapa");
  await page.getByLabel("Builder", { exact: true }).fill("Builder pendiente");
  await page
    .getByLabel("Persona de contacto", { exact: true })
    .fill("Ana Contacto");
  await page.getByRole("button", { name: "Crear obra", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("qh-demo-v1")!).projects[0],
  );
  expect(saved.address_source).toBe("manual");
  expect(saved.latitude).toBeNull();
  expect(saved.address_review_note).toContain("Obra nueva");
});
