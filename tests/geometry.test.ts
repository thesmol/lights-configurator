import test from "node:test";
import assert from "node:assert/strict";
import { catalog, quote } from "../shared";
import {
  trackBounds,
  trackLength,
  trackSegments,
} from "../domain/trackGeometry";
import { DEFAULT_PROJECT, normalizeProject } from "../src/project";
import { addFixture, reshapeTrack } from "../src/projectActions";
const base = DEFAULT_PROJECT.tracks[0];
const request = (layoutId: string, length = 2, depth = 2, tail = 2) => ({
  id: 1,
  productId: "surface",
  layoutId,
  length,
  depth,
  tail,
  fixtures: [],
});
const parts = (layoutId: string) =>
  quote({ tracks: [request(layoutId)] }).tracks[0].requirements;
const quantity = (layoutId: string, id: string) =>
  parts(layoutId).find((item) => item.id === id)?.quantity ?? 0;

test("shape dimensions produce distinct geometry and total length", () => {
  const z = { ...base, layoutId: "z", length: 2, depth: 1, tail: 3 };
  assert.equal(trackLength(z, catalog.layouts), 6);
  assert.deepEqual(trackBounds(z, catalog.layouts), { width: 5, depth: 1 });
  assert.equal(
    trackSegments(z, catalog.layouts).find((segment) => segment.id === "bottom")
      ?.length,
    3,
  );
  const rectangle = { ...base, layoutId: "rectangle", length: 3, depth: 2 };
  assert.equal(trackLength(rectangle, catalog.layouts), 10);
});
test("topology produces mandatory corners, tees, crosses, ends and independent feeds", () => {
  assert.equal(quantity("rectangle", "surface-end"), 0);
  assert.equal(quantity("rectangle", "surface-corner"), 4);
  assert.equal(quantity("rectangle", "surface-join"), 4);
  assert.equal(quantity("t", "surface-tee"), 1);
  assert.equal(quantity("t", "surface-end"), 3);
  assert.equal(quantity("cross", "surface-cross"), 1);
  assert.equal(quantity("cross", "surface-end"), 4);
  assert.equal(quantity("parallel", "power"), 2);
  assert.equal(quantity("parallel", "surface-end"), 4);
});
test("length, mounting type and fixture load change required parts", () => {
  const short = quote({ tracks: [request("line", 1)] }).tracks[0].requirements;
  const long = quote({
    tracks: [
      {
        ...request("line", 4),
        fixtures: Array.from({ length: 10 }, () => ({ type: "spot" })),
      },
    ],
  }).tracks[0].requirements;
  assert.equal(
    short.find((item) => item.id === "surface-join"),
    undefined,
  );
  assert.equal(long.find((item) => item.id === "surface-join")?.quantity, 3);
  assert.equal(long.find((item) => item.id === "power")?.quantity, 2);
  assert.ok(
    (long.find((item) => item.id === "surface-mount")?.quantity ?? 0) >
      (short.find((item) => item.id === "surface-mount")?.quantity ?? 0),
  );
  const recessed = quote({
    tracks: [{ ...request("line"), productId: "recessed" }],
  }).tracks[0].requirements;
  assert.ok(recessed.some((item) => item.id === "recessed-mount"));
  assert.ok(!recessed.some((item) => item.id.startsWith("surface")));
});
test("fixtures belong to segments and remain after changing shape", () => {
  const changed = reshapeTrack(
    DEFAULT_PROJECT,
    1,
    { layoutId: "corner", length: 2, depth: 2 },
    catalog,
  );
  assert.ok(changed);
  const added = addFixture(
    { ...changed, activeSegmentId: "side" },
    "line",
    catalog,
  );
  assert.equal(
    added.tracks[0].fixtures.filter((f) => f.segmentId === "side").length,
    1,
  );
  assert.equal(added.tracks[0].fixtures.length, 4);
  const restored = normalizeProject(added, catalog);
  assert.equal(restored?.activeSegmentId, "side");
  assert.equal(restored?.tracks[0].layoutId, "corner");
  assert.equal(restored?.tracks[0].fixtures.length, 4);
  assert.equal(reshapeTrack(added, 1, { length: 11 }, catalog), null);
});
