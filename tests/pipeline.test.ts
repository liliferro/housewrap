import { test } from "node:test";
import assert from "node:assert/strict";
import { demoData, type Estimate } from "../src/lib/model";
import { pipelineSummary, pipelineOpportunity } from "../src/lib/pipeline";
test("forecast counts works once, uses chosen reference or newest revision, and keeps unknown values separate", () => {
  const d = demoData();
  const p = d.projects[0];
  const base = {
    project_id: p.id,
    area: 1000,
    rate: 1,
    waste: 0,
    roll_size: 1000,
    rolls: 1,
    status: "approved",
  } as const;
  d.estimates = [
    { ...base, id: "old", total: 1000, created_at: "2026-10-01" },
    { ...base, id: "new", total: 2000, created_at: "2026-10-02" },
  ] as Estimate[];
  assert.equal(pipelineOpportunity(p, d).amount, 2000);
  assert.equal(
    pipelineSummary(d).find((c) => c.stage === "quoted")?.total,
    2000,
  );
  assert.equal(
    pipelineSummary(d).find((c) => c.stage === "received")?.unquoted,
    2,
  );
  p.quoted_estimate_id = "old";
  assert.equal(pipelineOpportunity(p, d).amount, 1000);
  p.pipeline_stage = "won";
  assert.equal(pipelineSummary(d).find((c) => c.stage === "quoted")?.total, 0);
  assert.equal(pipelineSummary(d).find((c) => c.stage === "won")?.total, 1000);
});
