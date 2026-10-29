import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAll } from "../src/lib/read-all";
test("history beyond API row limit is loaded once per record", async () => {
  const first = Array.from({ length: 1000 }, (_, id) => ({ id: String(id) }));
  let page = 0;
  const query = {
    order: () => query,
    range: async () => ({
      data: page++ === 0 ? first : [{ id: "999" }, { id: "1000" }],
      error: null,
    }),
  };
  const db = {
    from: () => ({ select: () => query }),
  } as unknown as SupabaseClient;
  const result = await readAll<{ id: string }>(db, "field_reports", [
    "created_at",
    "id",
  ]);
  assert.equal(result.data.length, 1001);
  assert.equal(result.data.at(-1)?.id, "1000");
  assert.equal(result.error, null);
});
