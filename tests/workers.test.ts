import { test } from "node:test";
import assert from "node:assert/strict";
import { demoData } from "../src/lib/model";
import { workerWeek, weekRange } from "../src/lib/workers";
test("weekly pay uses Monday to Sunday, approved identity-linked hours and date-effective rates", () => {
  assert.deepEqual(weekRange("2027-01-03"), {
    start: "2026-12-28",
    end: "2027-01-03",
  });
  const d = demoData();
  const worker = {
    user_id: "w",
    full_name: "Worker",
    email: "w@example.com",
    phone: "",
    created_at: "2026-01-01",
  };
  d.worker_rates = [
    { user_id: "w", effective_date: "2026-01-01", hourly_rate: 20 },
    { user_id: "w", effective_date: "2026-10-28", hourly_rate: 25 },
  ];
  const base = {
    project_id: d.projects[0].id,
    author_id: "w",
    author_name: "Worker",
    notes: "Complete",
    rolls: 1,
    created_at: "2026-10-28T12:00:00Z",
  };
  d.reports = [
    {
      ...base,
      id: "a",
      hours: 2,
      work_date: "2026-10-26",
      review_status: "approved",
    },
    {
      ...base,
      id: "b",
      hours: 3,
      work_date: "2026-10-28",
      review_status: "approved",
    },
    {
      ...base,
      id: "c",
      hours: 4,
      work_date: "2026-10-29",
      review_status: "pending",
    },
    {
      ...base,
      id: "d",
      hours: 2,
      work_date: "2026-10-30",
      review_status: "observed",
    },
    {
      ...base,
      id: "e",
      hours: 10,
      author_id: "someone-else",
      work_date: "2026-10-28",
      review_status: "approved",
    },
    {
      ...base,
      id: "f",
      hours: 10,
      work_date: "2026-11-02",
      review_status: "approved",
    },
  ];
  const summary = workerWeek(worker, d, "2026-10-28");
  assert.equal(summary.approved, 5);
  assert.equal(summary.pending, 4);
  assert.equal(summary.observed, 2);
  assert.equal(summary.amount, 115);
  d.worker_rates = [];
  assert.equal(workerWeek(worker, d, "2026-10-28").amount, null);
});
