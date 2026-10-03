import {
  catalog as demoCatalog,
  type Catalog,
  type Project,
  type TrackPlacement,
} from "../shared";
import {
  trackBounds,
  trackSegments,
  usableLength,
} from "../domain/trackGeometry";
import {
  findFreePosition,
  minimumTrackLength,
  placeFixtures,
} from "./placement";

export const MAX_TRACKS = 24;
export const MAX_FIXTURES = 200;
export const fixtureCount = (project: Project) =>
  project.tracks.reduce((sum, track) => sum + track.fixtures.length, 0);
export const updateTrack = (
  project: Project,
  id: number,
  update: (track: TrackPlacement) => TrackPlacement,
): Project => ({
  ...project,
  tracks: project.tracks.map((track) =>
    track.id === id ? update(track) : track,
  ),
});
export function tracksOverlap(
  a: TrackPlacement,
  b: TrackPlacement,
  catalog: Catalog = demoCatalog,
) {
  if (a.id === b.id) return false;
  return trackSegments(a, catalog.layouts).some((first) =>
    trackSegments(b, catalog.layouts).some((second) => {
      const overlapX =
        Math.min(
          Math.max(first.x1, first.x2) + a.x,
          Math.max(second.x1, second.x2) + b.x,
        ) -
        Math.max(
          Math.min(first.x1, first.x2) + a.x,
          Math.min(second.x1, second.x2) + b.x,
        );
      const overlapZ =
        Math.min(
          Math.max(first.z1, first.z2) + a.z,
          Math.max(second.z1, second.z2) + b.z,
        ) -
        Math.max(
          Math.min(first.z1, first.z2) + a.z,
          Math.min(second.z1, second.z2) + b.z,
        );
      return overlapX > -0.3 + 1e-8 && overlapZ > -0.3 + 1e-8;
    }),
  );
}
export function newTrack(
  project: Project,
  productId: string,
  catalog: Catalog = demoCatalog,
): TrackPlacement | null {
  if (project.tracks.length >= MAX_TRACKS) return null;
  const product = catalog.tracks.find((item) => item.id === productId);
  const layout = product?.layoutIds
    .map((id) => catalog.layouts.find((item) => item.id === id))
    .find((item) => item !== undefined);
  if (!layout) return null;
  const track: TrackPlacement = {
    id: Math.max(0, ...project.tracks.map((t) => t.id)) + 1,
    productId,
    color: "black",
    x: 0,
    z: 0,
    length: Math.min(2, project.roomW - 0.4),
    depth: 2,
    tail: 2,
    layoutId: layout.id,
    fixtures: [],
  };
  for (const parameter of layout.parameters)
    track[parameter.key] = parameter.default;
  const initialBounds = trackBounds(track, catalog.layouts);
  const factor = Math.min(
    1,
    (project.roomW - 0.4) / Math.max(0.01, initialBounds.width),
    (project.roomD - 0.7) / Math.max(0.01, initialBounds.depth),
  );
  for (const parameter of layout.parameters)
    track[parameter.key] = Math.min(
      parameter.max,
      Math.max(parameter.min, track[parameter.key] * factor),
    );
  const bounds = trackBounds(track, catalog.layouts);
  if (
    bounds.width > project.roomW - 0.4 + 1e-8 ||
    bounds.depth > project.roomD - 0.7 + 1e-8
  )
    return null;
  const slots = Math.floor(
    ((project.roomD - bounds.depth) / 2 - 0.35 + 1e-8) / 0.35,
  );
  for (let index = 0; index <= slots * 2; index++) {
    track.z = Math.ceil(index / 2) * 0.35 * (index % 2 ? 1 : -1);
    if (!project.tracks.some((other) => tracksOverlap(track, other, catalog)))
      return track;
  }
  return null;
}
export function fitFixturesToSegments(track: TrackPlacement, catalog: Catalog) {
  const segments = trackSegments(track, catalog.layouts);
  const placed: TrackPlacement["fixtures"] = [];
  for (const fixture of track.fixtures) {
    const preferred = fixture.segmentId ?? "main";
    const candidates = [...segments].sort(
      (a, b) => Number(b.id === preferred) - Number(a.id === preferred),
    );
    const segment = candidates.find(
      (segment) =>
        minimumTrackLength(
          [...placed.filter((f) => f.segmentId === segment.id), fixture],
          catalog.fixtures,
        ) <=
        usableLength(segment) + 1e-8,
    );
    if (!segment) return null;
    placed.push({ ...fixture, segmentId: segment.id });
  }
  return segments.flatMap((segment) =>
    placeFixtures(
      placed.filter((f) => f.segmentId === segment.id),
      usableLength(segment),
      catalog.fixtures,
    ),
  );
}
export function reshapeTrack(
  project: Project,
  id: number,
  patch: Partial<TrackPlacement>,
  catalog: Catalog,
): Project | null {
  const track = project.tracks.find((track) => track.id === id);
  if (!track) return null;
  const next = { ...track, ...patch };
  const bounds = trackBounds(next, catalog.layouts);
  if (
    bounds.width > project.roomW - 0.4 + 1e-8 ||
    bounds.depth > project.roomD - 0.7 + 1e-8
  )
    return null;
  next.x = Math.min(
    (project.roomW - bounds.width) / 2 - 0.2,
    Math.max(-(project.roomW - bounds.width) / 2 + 0.2, next.x),
  );
  next.z = Math.min(
    (project.roomD - bounds.depth) / 2 - 0.35,
    Math.max(-(project.roomD - bounds.depth) / 2 + 0.35, next.z),
  );
  if (project.tracks.some((other) => tracksOverlap(next, other, catalog)))
    return null;
  const fixtures = fitFixturesToSegments(next, catalog);
  if (!fixtures) return null;
  const result = updateTrack(project, id, () => ({ ...next, fixtures }));
  const segments = trackSegments(next, catalog.layouts);
  return {
    ...result,
    activeSegmentId: segments.some(
      (segment) => segment.id === project.activeSegmentId,
    )
      ? project.activeSegmentId
      : segments[0].id,
  };
}
function availableSegment(
  project: Project,
  track: TrackPlacement,
  type: string,
  catalog: Catalog,
) {
  return trackSegments(track, catalog.layouts)
    .sort(
      (a, b) =>
        Number(b.id === project.activeSegmentId) -
        Number(a.id === project.activeSegmentId),
    )
    .find(
      (segment) =>
        minimumTrackLength(
          [
            ...track.fixtures.filter(
              (f) => (f.segmentId ?? "main") === segment.id,
            ),
            { id: -1, type, t: 0.5 },
          ],
          catalog.fixtures,
        ) <=
        usableLength(segment) + 1e-8,
    );
}
export function cannotAddFixture(
  project: Project,
  track: TrackPlacement | undefined,
  type: string,
  catalog: Catalog,
): string | null {
  if (!track) return "Сначала добавьте трек";
  if (fixtureCount(project) >= MAX_FIXTURES)
    return `Лимит проекта — ${MAX_FIXTURES} светильников`;
  if (!availableSegment(project, track, type, catalog))
    return "На треке недостаточно места";
  return null;
}
export function addFixture(
  project: Project,
  type: string,
  catalog: Catalog,
): Project {
  const track = project.tracks.find((t) => t.id === project.activeTrackId);
  if (!track || cannotAddFixture(project, track, type, catalog)) return project;
  const segment = availableSegment(project, track, type, catalog)!;
  const currentFixtures = track.fixtures.filter(
    (f) => (f.segmentId ?? "main") === segment.id,
  );
  const fixture = {
    id: Math.max(0, ...track.fixtures.map((f) => f.id)) + 1,
    type,
    t: 0.5,
    segmentId: segment.id,
  };
  const free = findFreePosition(
    currentFixtures,
    usableLength(segment),
    type,
    0.5,
    catalog.fixtures,
  );
  const additions =
    free === null
      ? placeFixtures(
          [...currentFixtures, fixture],
          usableLength(segment),
          catalog.fixtures,
        )
      : [...currentFixtures, { ...fixture, t: free }];
  const fixtures = [
    ...track.fixtures.filter((f) => (f.segmentId ?? "main") !== segment.id),
    ...additions,
  ];
  return {
    ...updateTrack(project, track.id, (t) => ({ ...t, fixtures })),
    selectedFixture: { trackId: track.id, id: fixture.id },
    selectedTrackId: null,
    activeSegmentId: segment.id,
  };
}
export function removeFixture(
  project: Project,
  trackId: number,
  id: number,
): Project {
  return {
    ...updateTrack(project, trackId, (track) => ({
      ...track,
      fixtures: track.fixtures.filter((f) => f.id !== id),
    })),
    selectedFixture:
      project.selectedFixture?.trackId === trackId &&
      project.selectedFixture.id === id
        ? null
        : project.selectedFixture,
  };
}
export function removeTrack(project: Project, id: number): Project {
  const tracks = project.tracks.filter((track) => track.id !== id);
  return {
    ...project,
    tracks,
    selectedTrackId:
      project.selectedTrackId === id ? null : project.selectedTrackId,
    activeSegmentId:
      project.activeTrackId === id ? "main" : project.activeSegmentId,
    activeTrackId:
      project.activeTrackId === id
        ? (tracks[0]?.id ?? null)
        : project.activeTrackId,
    selectedFixture:
      project.selectedFixture?.trackId === id ? null : project.selectedFixture,
  };
}
