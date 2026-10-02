import {
  catalog,
  type Catalog,
  type FixturePlacement,
  type Project,
  type TrackPlacement,
} from "../shared";
import { fitFixturesToSegments } from "./projectActions";
import { trackBounds, trackSegments } from "../domain/trackGeometry";

export const DEFAULT_PROJECT: Project = {
  schemaVersion: 2,
  roomW: 5.2,
  roomD: 4,
  roomH: 2.8,
  tracks: [
    {
      id: 1,
      productId: "surface",
      color: "black",
      x: 0,
      z: 0,
      length: 3.2,
      layoutId: "line",
      depth: 2,
      tail: 2,
      fixtures: [
        { id: 1, type: "spot", t: 0.18 },
        { id: 2, type: "spot", t: 0.5 },
        { id: 3, type: "wide", t: 0.82 },
      ],
    },
  ],
  activeTrackId: 1,
  activeSegmentId: "main",
  selectedFixture: { trackId: 1, id: 2 },
  kelvin: 3000,
  brightness: 85,
  view: "3d",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

export function normalizeProject(
  value: unknown,
  source: Catalog = catalog,
): Project | null {
  const raw = object(value);
  if (!raw || (typeof raw.schemaVersion === "number" && raw.schemaVersion > 2))
    return null;
  const roomW = number(raw.roomW, DEFAULT_PROJECT.roomW, 2, 12);
  const roomD = number(raw.roomD, DEFAULT_PROJECT.roomD, 2, 12);
  const roomH = number(raw.roomH, DEFAULT_PROJECT.roomH, 2.2, 5);
  // Old single-track projects are migrated when loaded.
  const inputTracks = Array.isArray(raw.tracks)
    ? raw.tracks
    : Array.isArray(raw.fixtures)
      ? [
          {
            id: 1,
            productId: raw.mount,
            color: raw.color,
            x: raw.trackX,
            z: raw.trackZ,
            length: raw.trackL,
            fixtures: raw.fixtures,
          },
        ]
      : null;
  if (!inputTracks) return null;
  const tracks: TrackPlacement[] = [];
  const oldTrackIds = new Map<unknown, number>();
  const fixtureIds = new Map<string, number>();
  let totalFixtures = 0;
  for (const candidate of inputTracks.slice(0, 24)) {
    const track = object(candidate);
    if (!track || !Array.isArray(track.fixtures)) continue;
    const id = tracks.length + 1;
    oldTrackIds.set(track.id, id);
    const length = number(track.length, 2, 0.8, roomW - 0.4);
    const fixtures: FixturePlacement[] = [];
    for (const candidateFixture of track.fixtures) {
      if (totalFixtures >= 200) break;
      const fixture = object(candidateFixture);
      if (
        !fixture ||
        typeof fixture.type !== "string" ||
        fixture.type.length > 100
      )
        continue;
      const fixtureId = fixtures.length + 1;
      fixtureIds.set(`${String(track.id)}:${String(fixture.id)}`, fixtureId);
      fixtures.push({
        id: fixtureId,
        type: fixture.type,
        t: number(fixture.t, 0.5, 0.03, 0.97),
        segmentId:
          typeof fixture.segmentId === "string" ? fixture.segmentId : "main",
      });
      totalFixtures++;
    }
    const next: TrackPlacement = {
      id,
      productId:
        typeof track.productId === "string" && track.productId.length <= 100
          ? track.productId
          : catalog.tracks[0].id,
      color: track.color === "white" ? "white" : "black",
      length,
      layoutId:
        typeof track.layoutId === "string" &&
        source.layouts.some((layout) => layout.id === track.layoutId)
          ? track.layoutId
          : "line",
      depth: number(track.depth, 2, 0.8, roomD - 0.7),
      tail: number(track.tail, 2, 0.8, roomW - 0.4),
      x: number(
        track.x,
        0,
        -(roomW - length) / 2 + 0.2,
        (roomW - length) / 2 - 0.2,
      ),
      z: number(track.z, 0, -roomD / 2 + 0.35, roomD / 2 - 0.35),
      fixtures,
    };
    let bounds = trackBounds(next, source.layouts);
    const ratio = Math.min(
      1,
      (roomW - 0.4) / Math.max(0.01, bounds.width),
      (roomD - 0.7) / Math.max(0.01, bounds.depth),
    );
    next.length *= ratio;
    next.depth *= ratio;
    next.tail *= ratio;
    bounds = trackBounds(next, source.layouts);
    next.x = number(
      track.x,
      0,
      -(roomW - bounds.width) / 2 + 0.2,
      (roomW - bounds.width) / 2 - 0.2,
    );
    next.z = number(
      track.z,
      0,
      -(roomD - bounds.depth) / 2 + 0.35,
      (roomD - bounds.depth) / 2 - 0.35,
    );
    let fitted = fitFixturesToSegments(next, source);
    while (!fitted && next.fixtures.length) {
      next.fixtures.pop();
      fitted = fitFixturesToSegments(next, source);
    }
    next.fixtures = fitted ?? [];
    tracks.push(next);
  }
  const activeTrackId =
    oldTrackIds.get(raw.activeTrackId) ?? tracks[0]?.id ?? null;
  const oldSelected = object(raw.selectedFixture);
  const selectedTrackId = oldSelected
    ? oldTrackIds.get(oldSelected.trackId)
    : tracks[0]?.id;
  const selectedId = oldSelected
    ? fixtureIds.get(`${String(oldSelected.trackId)}:${String(oldSelected.id)}`)
    : typeof raw.selected === "number"
      ? fixtureIds.get(`1:${raw.selected}`)
      : undefined;
  const selectedFixture =
    selectedTrackId &&
    selectedId &&
    tracks
      .find((track) => track.id === selectedTrackId)
      ?.fixtures.some((fixture) => fixture.id === selectedId)
      ? { trackId: selectedTrackId, id: selectedId }
      : null;
  return {
    schemaVersion: 2,
    roomW,
    roomD,
    roomH,
    tracks,
    activeTrackId,
    activeSegmentId:
      trackSegments(
        tracks.find((track) => track.id === activeTrackId) ??
          DEFAULT_PROJECT.tracks[0],
        source.layouts,
      ).find((segment) => segment.id === raw.activeSegmentId)?.id ?? "main",
    selectedFixture,
    kelvin: Math.round(number(raw.kelvin, 3000, 2700, 5000) / 100) * 100,
    brightness: Math.round(number(raw.brightness, 85, 10, 100) / 5) * 5,
    view: raw.view === "plan" ? "plan" : "3d",
  };
}

export function createDefaultProject(source: Catalog = catalog): Project {
  if (
    source.tracks.some((item) => item.id === "surface") &&
    ["spot", "wide"].every((id) =>
      source.fixtures.some((item) => item.id === id),
    )
  )
    return DEFAULT_PROJECT;
  const product = source.tracks[0];
  return {
    ...DEFAULT_PROJECT,
    tracks: product
      ? [{ ...DEFAULT_PROJECT.tracks[0], productId: product.id, fixtures: [] }]
      : [],
    activeTrackId: product ? 1 : null,
    selectedFixture: null,
  };
}

export function readSavedProject(source: Catalog = catalog): Project {
  try {
    return (
      normalizeProject(
        JSON.parse(localStorage.getItem("lights-prototype-v1") ?? "null"),
        source,
      ) ?? createDefaultProject(source)
    );
  } catch {
    return createDefaultProject(source);
  }
}
