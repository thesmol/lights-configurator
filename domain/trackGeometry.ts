import type { TrackLayout, TrackPlacement, TrackDimension } from "./types.js";
export interface TrackSegment {
  id: string;
  label: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  length: number;
  padding: number;
}
export function trackSegments(
  track: Pick<TrackPlacement, "layoutId" | "length" | "depth" | "tail">,
  layouts: TrackLayout[],
): TrackSegment[] {
  const layout = layouts.find((item) => item.id === track.layoutId);
  if (!layout) return [];
  const coordinate = (terms: Partial<Record<TrackDimension, number>>) =>
    Object.entries(terms).reduce(
      (sum, [key, coefficient]) =>
        sum + track[key as TrackDimension] * (coefficient ?? 0),
      0,
    );
  const raw = layout.segments.map((segment) => ({
    id: segment.id,
    label: segment.label,
    x1: coordinate(segment.start[0]),
    z1: coordinate(segment.start[1]),
    x2: coordinate(segment.end[0]),
    z2: coordinate(segment.end[1]),
  }));
  const centerX =
    (Math.min(...raw.flatMap((s) => [s.x1, s.x2])) +
      Math.max(...raw.flatMap((s) => [s.x1, s.x2]))) /
    2;
  const centerZ =
    (Math.min(...raw.flatMap((s) => [s.z1, s.z2])) +
      Math.max(...raw.flatMap((s) => [s.z1, s.z2]))) /
    2;
  return raw.map((segment) => ({
    ...segment,
    x1: segment.x1 - centerX,
    x2: segment.x2 - centerX,
    z1: segment.z1 - centerZ,
    z2: segment.z2 - centerZ,
    length: Math.hypot(segment.x2 - segment.x1, segment.z2 - segment.z1),
    padding: layout.segments.length > 1 ? 0.12 : 0,
  }));
}
export const usableLength = (segment: TrackSegment) =>
  segment.length - segment.padding * 2;
export function fixturePoint(segment: TrackSegment, t: number) {
  const along = (segment.padding + t * usableLength(segment)) / segment.length;
  return {
    x: segment.x1 + (segment.x2 - segment.x1) * along,
    z: segment.z1 + (segment.z2 - segment.z1) * along,
  };
}
export function trackBounds(track: TrackPlacement, layouts: TrackLayout[]) {
  const segments = trackSegments(track, layouts);
  return {
    width: Math.max(0, ...segments.flatMap((s) => [s.x1, s.x2])) * 2,
    depth: Math.max(0, ...segments.flatMap((s) => [s.z1, s.z2])) * 2,
  };
}
export const trackLength = (track: TrackPlacement, layouts: TrackLayout[]) =>
  trackSegments(track, layouts).reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
