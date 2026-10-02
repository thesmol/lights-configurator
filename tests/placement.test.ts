import assert from "node:assert/strict";
import test from "node:test";
import type { FixturePlacement } from "../shared";
import {
  findFreePosition,
  minimumTrackLength,
  moveFixture,
  placeFixtures,
} from "../src/placement";

test("addition respects fixture widths and track capacity", () => {
  const fixtures: FixturePlacement[] = [
    { id: 1, type: "line", t: 0.21 / 0.88 },
    { id: 2, type: "line", t: 0.67 / 0.88 },
  ];
  assert.equal(minimumTrackLength(fixtures), 0.88);
  assert.equal(findFreePosition(fixtures, 0.88, "spot"), null);
  const t = findFreePosition(fixtures, 1.5, "spot");
  assert.ok(t !== null);
  const placed = placeFixtures([...fixtures, { id: 3, type: "spot", t }], 1.5);
  assert.equal(placed.length, 3);
  assert.ok(
    placed[1].t * 1.5 - placed[0].t * 1.5 >= 0.38 / 2 + 0.08 + 0.16 / 2 - 1e-8,
  );
});

test("dragging crosses neighbors and snaps outside their occupied space", () => {
  const fixtures: FixturePlacement[] = [
    { id: 1, type: "spot", t: 0.25 },
    { id: 2, type: "line", t: 0.6 },
  ];
  const moved = moveFixture(fixtures, 2, 1, 0.95);
  assert.ok(moved[0].t > moved[1].t);
  const ontoNeighbor = moveFixture(fixtures, 2, 1, 0.6);
  assert.ok(
    Math.abs(ontoNeighbor[0].t - ontoNeighbor[1].t) >=
      (0.16 / 2 + 0.38 / 2 + 0.08) / 2 - 1e-8,
  );
});
