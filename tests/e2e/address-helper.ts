import { type Page } from "@playwright/test";
export const testAddress = {
  id: "W28912103",
  label: "225 Baker Street Northwest, Atlanta, Georgia 30313, USA",
  lat: 33.7632675,
  lon: -84.3951173,
};
export async function fillAddress(page: Page) {
  await page.route("**/api/addresses?**", (route) =>
    route.fulfill({ json: { results: [testAddress] } }),
  );
  await page
    .getByLabel("Dirección de la obra", { exact: true })
    .fill("225 Baker Street Atlanta");
  await page
    .getByRole("option", { name: testAddress.label, exact: true })
    .click();
}
