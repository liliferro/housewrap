import { test } from "node:test";
import assert from "node:assert/strict";
import { areaProgress } from "../src/lib/area-progress";
import { demoData } from "../src/lib/model";
test("progress counts only approved new area, handles missing area and caps display", () => {
  const d = demoData(),
    p = d.projects[0];
  d.estimates = [
    {
      id: "q",
      project_id: p.id,
      status: "approved",
      area: 2400,
      rate: 1,
      total: 2400,
      rolls: 2,
      roll_size: 1350,
      waste: 0,
      created_at: "2026-10-29",
    },
  ];
  const base = {
    project_id: p.id,
    notes: "test",
    hours: 1,
    rolls: 0,
    created_at: "2026-10-29",
  };
  d.reports = [
    { ...base, id: "a", installed_area: 600, review_status: "approved" },
    { ...base, id: "b", installed_area: 900, review_status: "pending" },
    { ...base, id: "c", installed_area: 200, review_status: "observed" },
    { ...base, id: "d", review_status: "approved" },
  ];
  assert.equal(areaProgress(p, d).percent, 25);
  assert.equal(areaProgress(p, d).missing, 1);
  d.reports[0].installed_area = 2500;
  assert.equal(areaProgress(p, d).percent, 100);
  assert.equal(areaProgress(p, d).over, true);
  d.estimates = [];
  assert.equal(areaProgress(p, d).percent, null);
  assert.equal(areaProgress(p, d, true).area, 2500);
  assert.equal(areaProgress(p, d, true).missing, 1);
  assert.equal(
    areaProgress({ ...p, approved_area: 600, target_area: 2400 }, d).percent,
    25,
  );
});
