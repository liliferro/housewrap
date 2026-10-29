import { test, expect } from "@playwright/test";

test("activation page keeps invite tokens out of server requests", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  await page.goto("/activate#token_hash=example-test-token");
  await expect(
    page.getByRole("heading", { name: "Elige tu contraseña." }),
  ).toBeVisible();
  await page.getByLabel("Nueva contraseña").fill("LongPassword123!");
  await page.getByLabel("Repite la contraseña").fill("DifferentPassword123!");
  // No auth calls or token consumption occur just by opening the invitation.
  expect(requested.some((url) => url.includes("/auth/v1/verify"))).toBe(false);
  expect(requested.some((url) => url.includes("token_hash"))).toBe(false);
});
