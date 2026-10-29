import { test } from "node:test";
import assert from "node:assert/strict";
import { measureWalls } from "../src/lib/measurements";
import { calculate } from "../src/lib/model";
const input = {
  version: 1,
  units: "ft",
  reference: "A201",
  reviewed: true,
  roll_width_ft: 9,
  roll_length_ft: 150,
  rows: [
    { label: "Muros", shape: "rectangle", width: 140, height: 18, quantity: 1 },
    {
      label: "Frontones",
      shape: "triangle",
      width: 30,
      height: 6,
      quantity: 2,
    },
  ],
};
test("facades and triangular gables produce gross area and full rolls", () => {
  const r = measureWalls(input);
  assert.equal(r.area, 2700);
  assert.equal(r.rollSize, 1350);
  const e = calculate({
    area: r.area,
    roll_size: r.rollSize,
    rate: 1.25,
    waste: 10,
  });
  assert.equal(e.rolls, 3);
  assert.equal(e.total, 3375);
});
test("meters convert to square feet", () => {
  assert.equal(
    measureWalls({
      ...input,
      units: "m",
      rows: [{ ...input.rows[0], width: 10, height: 3 }],
    }).area,
    322.92,
  );
});
test("invalid and unreviewed geometry is rejected", () => {
  for (const changes of [
    { reviewed: false },
    { rows: [] },
    { rows: [{ ...input.rows[0], quantity: 1.5 }] },
    { rows: [{ ...input.rows[0], height: 0 }] },
    { roll_width_ft: 0 },
  ])
    assert.throws(() => measureWalls({ ...input, ...changes }));
});
