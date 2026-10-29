import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryDays, operationMetrics } from "../src/lib/operations";
import { demoData } from "../src/lib/model";
test("delivery dates use calendar days, including month changes and absent dates", () => {
  const today = new Date(2026, 9, 31, 23, 59);
  assert.equal(deliveryDays("2026-11-01", today), 1);
  assert.equal(deliveryDays("2026-10-31", today), 0);
  assert.equal(deliveryDays("2026-10-29", today), -2);
  assert.equal(deliveryDays(null, today), null);
});
test("operations isolate reports, use only selected approved quote, and suppress alerts for completed works", () => {
  const data = demoData();
  const p = {
    ...data.projects[0],
    target_date: "2026-10-25",
    quoted_estimate_id: "q",
  };
  data.reports = [
    {
      id: "r",
      project_id: p.id,
      notes: "Avance",
      hours: 2.5,
      rolls: 3.5,
      created_at: "2026-10-20T12:00:00Z",
    },
    {
      id: "other",
      project_id: "other",
      notes: "Otro",
      hours: 20,
      rolls: 20,
      created_at: "2026-10-28T12:00:00Z",
    },
  ];
  data.estimates = [
    {
      id: "q",
      project_id: p.id,
      status: "approved",
      rolls: 3,
      total: 300,
      area: 100,
      rate: 3,
      waste: 0,
      roll_size: 40,
      created_at: "2026-10-01T00:00:00Z",
    },
  ];
  const now = new Date(2026, 9, 28, 12);
  const m = operationMetrics(p, data, now);
  assert.equal(m.rolls, 3.5);
  assert.equal(m.hours, 2.5);
  assert.equal(m.days, -3);
  assert.equal(m.alerts.length, 3);
  assert.equal(
    operationMetrics({ ...p, quoted_estimate_id: null }, data, now).quote?.id,
    "q",
  );
  assert.deepEqual(
    operationMetrics({ ...p, status: "done" }, data, now).alerts,
    [],
  );
});
