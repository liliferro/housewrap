import { test, expect } from "@playwright/test";

test("reuse a builder and contact across works and edit shared contact details", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Nueva obra" }).click();
  await page.getByLabel("Nombre de la obra").fill("Contacto obra uno");
  await page.getByLabel("Builder", { exact: true }).fill("Builder compartido");
  await page
    .getByLabel("Persona de contacto", { exact: true })
    .fill("María Builder");
  await page
    .getByLabel("Teléfono (opcional)", { exact: true })
    .fill("+1 404 555 0101");
  await page.getByLabel("Dirección de la obra").fill("Atlanta GA");
  await page.getByRole("button", { name: "Crear obra", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Nueva obra" }).click();
  await page.getByLabel("Nombre de la obra").fill("Contacto obra dos");
  await page
    .getByLabel("Seleccionar builder")
    .selectOption({ label: "Builder compartido" });
  await page
    .getByLabel("Seleccionar contacto")
    .selectOption({ label: "María Builder" });
  await page.getByLabel("Dirección de la obra").fill("Marietta GA");
  await page.getByRole("button", { name: "Crear obra", exact: true }).click();
  await page
    .getByRole("button", { name: "Builders y contactos", exact: true })
    .click();
  const card = page
    .locator(".builder-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Builder compartido",
        exact: true,
      }),
    });
  await expect(card).toContainText("2 obras");
  await card.getByRole("button", { name: "Editar contacto" }).click();
  await card
    .getByLabel("Correo electrónico (opcional)")
    .fill("maria@example.com");
  await card.getByLabel("Teléfono (opcional)").fill("");
  await card.getByRole("button", { name: "Guardar cambios" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Obras", exact: true }).click();
  for (const name of ["Contacto obra uno", "Contacto obra dos"]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(
      page.getByRole("dialog").getByRole("link", { name: "maria@example.com" }),
    ).toHaveAttribute("href", "mailto:maria@example.com");
    await expect(page.getByRole("dialog")).not.toContainText("+1 404");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  }
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("qh-demo-v1")!),
  );
  expect(
    saved.builders.filter(
      (b: { name: string }) => b.name === "Builder compartido",
    ),
  ).toHaveLength(1);
  expect(
    saved.contacts.filter((c: { name: string }) => c.name === "María Builder"),
  ).toHaveLength(1);
});
