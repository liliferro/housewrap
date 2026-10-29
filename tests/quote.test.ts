import { test } from "node:test";
import assert from "node:assert/strict";
import { projectQuote } from "../src/lib/quote";
import { demoData, type Estimate } from "../src/lib/model";
test("quote fallback respects manual references, dates, project isolation and approval", () => {
  const d = demoData(),
    p = d.projects[0];
  const base = {
    project_id: p.id,
    status: "approved",
    total: 3000,
    rolls: 2,
    area: 2400,
    rate: 1.25,
    waste: 8,
    roll_size: 1350,
  };
  d.estimates = [
    { ...base, id: "old", created_at: "2026-10-01" },
    { ...base, id: "new", created_at: "2026-10-02" },
    { ...base, id: "draft", status: "draft", created_at: "2026-10-03" },
    { ...base, id: "other", project_id: "other", created_at: "2026-10-04" },
  ] as Estimate[];
  assert.equal(projectQuote(p, d)?.id, "new");
  assert.equal(projectQuote({ ...p, quoted_estimate_id: "old" }, d)?.id, "old");
  d.estimates = d.estimates.filter(
    (e) => e.status !== "approved" || e.project_id !== p.id,
  );
  assert.equal(projectQuote(p, d), undefined);
});
