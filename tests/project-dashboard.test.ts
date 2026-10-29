import { test } from "node:test";
import assert from "node:assert/strict";
import { projectMetrics } from "../src/components/project-dashboard";
import { demoData, type Estimate } from "../src/lib/model";
test("dashboard isolates works, sums decimal reports and selects only the quoted revision", () => {
  const data = demoData();
  const p = {
    ...data.projects[0],
    started_at: "2026-10-28T08:00:00Z",
    finished_at: "2026-10-28T18:00:00Z",
    quoted_estimate_id: "quoted",
  };
  const base = {
    project_id: p.id,
    area: 100,
    rate: 1,
    waste: 0,
    roll_size: 50,
    rolls: 2,
    status: "approved" as const,
    created_at: "2026-10-28T08:00:00Z",
  };
  data.estimates = [
    { ...base, id: "older", total: 100 },
    { ...base, id: "quoted", total: 120 },
  ] as Estimate[];
  data.reports = [
    {
      id: "a",
      project_id: p.id,
      notes: "Work one",
      hours: 2.5,
      rolls: 1.25,
      created_at: base.created_at,
    },
    {
      id: "b",
      project_id: p.id,
      notes: "Work two",
      hours: 3.25,
      rolls: 0.5,
      created_at: base.created_at,
    },
    {
      id: "c",
      project_id: data.projects[1].id,
      notes: "Other work",
      hours: 20,
      rolls: 40,
      created_at: base.created_at,
    },
  ];
  const m = projectMetrics(p, data);
  assert.equal(m.hours, 5.75);
  assert.equal(m.rolls, 1.75);
  assert.equal(m.quote?.total, 120);
  assert.equal(m.elapsed, 10);
  assert.equal(m.reports.length, 2);
  assert.equal(
    projectMetrics({ ...p, quoted_estimate_id: null, started_at: null }, data)
      .quote,
    undefined,
  );
  assert.equal(projectMetrics({ ...p, started_at: null }, data).elapsed, null);
});
