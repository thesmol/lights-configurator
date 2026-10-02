import assert from "node:assert/strict";
import test from "node:test";
import { quote } from "../shared";
import { DEFAULT_PROJECT, normalizeProject } from "../src/project";

test("quote uses catalog prices and includes connection parts", () => {
  const result = quote({
    mount: "surface",
    trackL: 3.2,
    fixtures: [{ type: "spot" }, { type: "wide" }],
  });
  assert.equal(result.total, 45_400);
  assert.equal(result.watts, 28);
  assert.equal(result.lumens, 2_150);
  assert.deepEqual(
    result.items.map((item) => item.quantity),
    [4, 1, 1, 1, 2],
  );
});

test("quote rejects unknown products and invalid lengths", () => {
  assert.throws(
    () =>
      quote({ mount: "surface", trackL: 3.2, fixtures: [{ type: "unknown" }] }),
    /Неизвестный светильник/,
  );
  assert.throws(
    () => quote({ mount: "surface", trackL: "3.2", fixtures: [] }),
    /Недопустимые параметры/,
  );
});

test("saved project is bounded before it reaches the 3D scene", () => {
  const project = normalizeProject({
    ...DEFAULT_PROJECT,
    roomW: 2,
    trackL: 50,
    brightness: -10,
    fixtures: [
      { id: 9, type: "spot", t: 4 },
      { id: 10, type: "invalid", t: 0.5 },
    ],
    selected: 9,
  });
  assert.ok(project);
  assert.equal(project.trackL, 1.6);
  assert.equal(project.brightness, 10);
  assert.equal(project.fixtures.length, 1);
  assert.equal(project.fixtures[0].t, 0.9375);
  assert.equal(project.selected, 1);
});
