import { test, expect } from "@playwright/test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("photos and audio survive drafts and can be opened after sending without text", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Avances de obra", exact: true })
    .click();
  await page
    .getByLabel("¿En qué obra trabajaste?")
    .selectOption({ label: "Oakview · Lot 14" });
  await page.getByLabel("Nombre del trabajador").fill("Ana campo");
  await page.getByLabel("Horas reportadas").fill("2");
  await page.getByLabel("Rollos utilizados").fill("1");
  await page
    .getByLabel("Adjuntar fotos", { exact: true })
    .setInputFiles({ name: "fachada.png", mimeType: "image/png", buffer: png });
  const wav = Buffer.alloc(16044);
  wav.write("RIFF");
  wav.writeUInt32LE(16036, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page
    .getByLabel("Adjuntar audio", { exact: true })
    .setInputFiles({ name: "voz.wav", mimeType: "audio/wav", buffer: wav });
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Borrador con archivos");
  await page.reload();
  await page
    .getByRole("button", { name: "Avances de obra", exact: true })
    .click();
  await expect(
    page.locator("figcaption").filter({ hasText: "fachada.png" }),
  ).toBeVisible();
  await expect(page.locator("audio")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar y enviar", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Avance recibido");
  await page.reload();
  await page.getByRole("button", { name: "Ver foto", exact: true }).click();
  await expect(page.locator(".media-grid img")).toBeVisible();
  await page
    .getByRole("button", { name: "Escuchar audio", exact: true })
    .click();
  await expect(page.locator(".media-grid audio")).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("qh-demo-v1")!),
  );
  expect(data.reports).toHaveLength(1);
  expect(data.reports[0].attachments).toHaveLength(2);
  expect(data.reports[0].notes).toBe("");
});

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["microphone"],
});
test("records, stops and previews microphone audio", async ({ page }) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Avances de obra", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Grabar nota de voz", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Detener grabación", exact: true }),
  ).toBeVisible();
  // Capture at least one chunk from Chromium's synthetic audio device.
  await page.waitForTimeout(1100);
  await page
    .getByRole("button", { name: "Detener grabación", exact: true })
    .click();
  await expect(page.locator(".media-grid audio")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Grabar nota de voz", exact: true }),
  ).toBeDisabled();
});
