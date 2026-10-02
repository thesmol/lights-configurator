import assert from "node:assert/strict";
import test from "node:test";
import { catalog, quote, type Catalog } from "../shared";
import { DEFAULT_PROJECT, normalizeProject } from "../src/project";
import {
  addFixture,
  newTrack,
  removeFixture,
  removeTrack,
} from "../src/projectActions";

test("quote aggregates independent tracks and connection parts", () => {
  const result = quote({
    tracks: [
      {
        productId: "surface",
        length: 3.2,
        fixtures: [{ type: "spot" }, { type: "wide" }],
      },
      { productId: "recessed", length: 2, fixtures: [{ type: "spot" }] },
    ],
  });
  assert.equal(result.total, 77700);
  assert.equal(result.trackCount, 2);
  assert.equal(result.fixtureCount, 3);
  assert.equal(result.watts, 40);
  assert.equal(result.items.find((item) => item.id === "power")?.quantity, 2);
  assert.equal(result.items.find((item) => item.id === "spot")?.quantity, 2);
});
test("quote rejects invalid products, dimensions and overfilled tracks", () => {
  assert.throws(
    () =>
      quote({
        tracks: [
          { productId: "surface", length: 3, fixtures: [{ type: "unknown" }] },
        ],
      }),
    /Неизвестный светильник/,
  );
  assert.throws(
    () =>
      quote({ tracks: [{ productId: "surface", length: "3", fixtures: [] }] }),
    /Недопустимый трек/,
  );
  assert.throws(
    () =>
      quote({
        tracks: [
          {
            productId: "surface",
            length: 0.8,
            fixtures: [{ type: "line" }, { type: "line" }],
          },
        ],
      }),
    /не помещаются/,
  );
});
test("legacy projects migrate with bounded dimensions and preserved selection", () => {
  const project = normalizeProject({
    roomW: 2,
    trackL: 50,
    mount: "surface",
    brightness: -10,
    fixtures: [{ id: 9, type: "spot", t: 4 }],
    selected: 9,
  });
  assert.ok(project);
  assert.equal(project.tracks[0].length, 1.6);
  assert.equal(project.brightness, 10);
  assert.equal(project.tracks[0].fixtures[0].t, 0.9375);
  assert.deepEqual(project.selectedFixture, { trackId: 1, id: 1 });
});
test("cleared selection and multiple tracks survive save and restore", () => {
  const second = newTrack(DEFAULT_PROJECT, "recessed");
  assert.ok(second);
  const saved = {
    ...DEFAULT_PROJECT,
    tracks: [...DEFAULT_PROJECT.tracks, second],
    activeTrackId: second.id,
    selectedFixture: null,
  };
  const result = normalizeProject(JSON.parse(JSON.stringify(saved)));
  assert.equal(result?.tracks.length, 2);
  assert.equal(result?.activeTrackId, 2);
  assert.equal(result?.selectedFixture, null);
});
test("adding and removing fixtures only affects the selected track", () => {
  const second = newTrack(DEFAULT_PROJECT, "surface");
  assert.ok(second);
  const project = {
    ...DEFAULT_PROJECT,
    tracks: [...DEFAULT_PROJECT.tracks, second],
    activeTrackId: second.id,
  };
  const added = addFixture(project, "line", catalog);
  assert.equal(added.tracks[0], project.tracks[0]);
  assert.equal(added.tracks[1].fixtures.length, 1);
  assert.deepEqual(added.selectedFixture, { trackId: second.id, id: 1 });
  const removed = removeFixture(added, second.id, 1);
  assert.equal(removed.tracks[0].fixtures.length, 3);
  assert.equal(removed.tracks[1].fixtures.length, 0);
  assert.equal(removeTrack(added, second.id).activeTrackId, 1);
});
test("new catalog IDs use product dimensions and prices without renderer ID checks", () => {
  const extended: Catalog = {
    ...catalog,
    fixtures: [
      ...catalog.fixtures,
      {
        ...catalog.fixtures[2],
        id: "long-bar-900",
        name: "Long Bar",
        width: 0.9,
        price: 123,
      },
    ],
    tracks: [
      ...catalog.tracks,
      { ...catalog.tracks[0], id: "track-new", price: 456 },
    ],
  };
  const project = normalizeProject(
    {
      ...DEFAULT_PROJECT,
      tracks: [
        {
          ...DEFAULT_PROJECT.tracks[0],
          productId: "track-new",
          length: 1,
          fixtures: [{ id: 1, type: "long-bar-900", t: 0.99 }],
        },
      ],
    },
    extended,
  );
  assert.ok(project);
  assert.equal(project.tracks[0].fixtures[0].t, 0.53);
  assert.equal(addFixture(project, "long-bar-900", extended), project);
  const result = quote(
    {
      tracks: [
        {
          productId: "track-new",
          length: 1,
          fixtures: [{ type: "long-bar-900" }],
        },
      ],
    },
    extended,
  );
  assert.equal(
    result.items.find((item) => item.id === "long-bar-900")?.unitPrice,
    123,
  );
});
