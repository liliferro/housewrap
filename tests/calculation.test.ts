import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, reportSchema, projectSchema } from "../src/lib/model";
test("gross area is billable and waste affects material only", () => {
  const e = calculate({ area: 2400, rate: 1.25, waste: 8, roll_size: 1350 });
  assert.equal(e.total, 3000);
  assert.equal(e.rolls, 2);
  assert.equal(e.area, 2400);
});
test("rolls round up and prices round to cents", () => {
  const e = calculate({ area: 1350.01, rate: 1.17, waste: 0, roll_size: 1350 });
  assert.equal(e.rolls, 2);
  assert.equal(e.total, 1579.51);
});
test("rejects impossible geometry and rates", () => {
  for (const change of [
    { area: 0 },
    { roll_size: 0 },
    { rate: -1 },
    { waste: 51 },
    { area: Infinity },
  ])
    assert.throws(() =>
      calculate({ area: 100, rate: 1, waste: 5, roll_size: 100, ...change }),
    );
});
test("reports require a project, meaningful text and bounded hours", () => {
  assert.equal(
    reportSchema.safeParse({
      project_id: "invalid",
      notes: "ok",
      hours: 25,
      rolls: 0,
    }).success,
    false,
  );
  assert.equal(
    projectSchema.safeParse({
      name: "",
      builder: "",
      address: "",
      target_date: "",
    }).success,
    false,
  );
});
