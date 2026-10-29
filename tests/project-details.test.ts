import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProjectDetails } from "../src/lib/project-details";
test("optional project details remain unknown and scheduled dates are consistent", () => {
  const form = new FormData();
  assert.equal(parseProjectDetails(form).project_type, null);
  assert.equal(parseProjectDetails(form).notes, "");
  form.set("planned_start", "2026-11-10");
  assert.throws(() => parseProjectDetails(form, "2026-11-01"));
  assert.equal(
    parseProjectDetails(form, "2026-11-10").planned_start,
    "2026-11-10",
  );
  form.set("project_type", "arbitrary");
  assert.throws(() => parseProjectDetails(form));
  form.set("project_type", "commercial");
  form.set("notes", "x".repeat(3001));
  assert.throws(() => parseProjectDetails(form));
});
