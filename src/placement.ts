import type { FixturePlacement, FixtureType } from "../shared";

const widths: Record<FixtureType, number> = {
  spot: 0.16,
  wide: 0.2,
  line: 0.38,
};
const gap = 0.08;
const edge = 0.02;

export function minimumTrackLength(fixtures: FixturePlacement[]): number {
  return (
    fixtures.reduce(
      (length, fixture) => length + widths[fixture.type],
      edge * 2,
    ) +
    Math.max(0, fixtures.length - 1) * gap
  );
}

export function findFreePosition(
  fixtures: FixturePlacement[],
  trackL: number,
  type: FixtureType,
  preferred = 0.5,
): number | null {
  const sorted = [...fixtures].sort((a, b) => a.t - b.t);
  const half = widths[type] / 2;
  const desired = preferred * trackL;
  let left = edge + half;
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const next of [...sorted, null]) {
    const right = next
      ? next.t * trackL - widths[next.type] / 2 - gap - half
      : trackL - edge - half;
    if (left <= right + 1e-8) {
      const candidate = Math.min(right, Math.max(left, desired));
      const distance = Math.abs(candidate - desired);
      if (distance < bestDistance) {
        best = candidate / trackL;
        bestDistance = distance;
      }
    }
    if (next) left = next.t * trackL + widths[next.type] / 2 + gap + half;
  }
  return best;
}

export function moveFixture(
  fixtures: FixturePlacement[],
  trackL: number,
  id: number,
  desired: number,
): FixturePlacement[] {
  const current = fixtures.find((fixture) => fixture.id === id);
  if (!current) return fixtures;
  const t = findFreePosition(
    fixtures.filter((fixture) => fixture.id !== id),
    trackL,
    current.type,
    desired,
  );
  if (t === null) return fixtures;
  return fixtures.map((fixture) =>
    fixture.id === id ? { ...fixture, t } : fixture,
  );
}

export function placeFixtures(
  fixtures: FixturePlacement[],
  trackL: number,
): FixturePlacement[] {
  if (minimumTrackLength(fixtures) > trackL + 1e-8) return [];
  const sorted = [...fixtures].sort((a, b) => a.t - b.t);
  const placed: FixturePlacement[] = [];
  let left = edge;
  for (let index = 0; index < sorted.length; index++) {
    const fixture = sorted[index];
    const half = widths[fixture.type] / 2;
    const remaining = sorted.slice(index + 1);
    const right =
      trackL -
      edge -
      half -
      remaining.reduce((sum, item) => sum + widths[item.type], 0) -
      remaining.length * gap;
    const center = Math.min(right, Math.max(left + half, fixture.t * trackL));
    placed.push({ ...fixture, t: center / trackL });
    left = center + half + gap;
  }
  return placed;
}
