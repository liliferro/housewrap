import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMedia } from "../src/lib/progress-media";
const item = (type: string, size = 10) => ({
  id: crypto.randomUUID(),
  file: new File([new Uint8Array(size)], "file", { type }),
});
test("media limits reject unsupported, empty, oversized and excess attachments", () => {
  assert.doesNotThrow(() =>
    validateMedia([item("image/jpeg"), item("audio/webm")]),
  );
  assert.throws(() => validateMedia([item("text/html")]));
  assert.throws(() => validateMedia([item("image/png", 0)]));
  assert.throws(() => validateMedia([item("image/png", 10 * 1024 * 1024 + 1)]));
  assert.throws(() =>
    validateMedia(Array.from({ length: 6 }, () => item("image/png"))),
  );
  assert.throws(() => validateMedia([item("audio/webm"), item("audio/mp4")]));
});
