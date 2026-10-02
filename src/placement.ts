import {
  catalog as demoCatalog,
  FIXTURE_GAP,
  TRACK_EDGE,
  type FixturePlacement,
  type LightProduct,
} from "../shared";

const gap = FIXTURE_GAP;
const edge = TRACK_EDGE;

export function fixtureWidth(
  type: string,
  products: LightProduct[] = demoCatalog.fixtures,
): number {
  return products.find((item) => item.id === type)?.width ?? 0.2;
}

export function minimumTrackLength(
  fixtures: FixturePlacement[],
  products: LightProduct[] = demoCatalog.fixtures,
): number {
  return (
    fixtures.reduce(
      (length, fixture) => length + fixtureWidth(fixture.type, products),
      edge * 2,
    ) +
    Math.max(0, fixtures.length - 1) * gap
  );
}

export function findFreePosition(
  fixtures: FixturePlacement[],
  trackL: number,
  type: string,
  preferred = 0.5,
  products: LightProduct[] = demoCatalog.fixtures,
): number | null {
  const sorted = [...fixtures].sort((a, b) => a.t - b.t);
  const half = fixtureWidth(type, products) / 2;
  const desired = preferred * trackL;
  let left = edge + half;
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const next of [...sorted, null]) {
    const right = next
      ? next.t * trackL - fixtureWidth(next.type, products) / 2 - gap - half
      : trackL - edge - half;
    if (left <= right + 1e-8) {
      const candidate = Math.min(right, Math.max(left, desired));
      const distance = Math.abs(candidate - desired);
      if (distance < bestDistance) {
        best = candidate / trackL;
        bestDistance = distance;
      }
    }
    if (next)
      left =
        next.t * trackL + fixtureWidth(next.type, products) / 2 + gap + half;
  }
  return best;
}

export function moveFixture(
  fixtures: FixturePlacement[],
  trackL: number,
  id: number,
  desired: number,
  products: LightProduct[] = demoCatalog.fixtures,
): FixturePlacement[] {
  const current = fixtures.find((fixture) => fixture.id === id);
  if (!current) return fixtures;
  const t = findFreePosition(
    fixtures.filter((fixture) => fixture.id !== id),
    trackL,
    current.type,
    desired,
    products,
  );
  if (t === null) return fixtures;
  return fixtures.map((fixture) =>
    fixture.id === id ? { ...fixture, t } : fixture,
  );
}

export function placeFixtures(
  fixtures: FixturePlacement[],
  trackL: number,
  products: LightProduct[] = demoCatalog.fixtures,
): FixturePlacement[] {
  if (minimumTrackLength(fixtures, products) > trackL + 1e-8) return [];
  const sorted = [...fixtures].sort((a, b) => a.t - b.t);
  const placed: FixturePlacement[] = [];
  let left = edge;
  for (let index = 0; index < sorted.length; index++) {
    const fixture = sorted[index];
    const half = fixtureWidth(fixture.type, products) / 2;
    const remaining = sorted.slice(index + 1);
    const right =
      trackL -
      edge -
      half -
      remaining.reduce(
        (sum, item) => sum + fixtureWidth(item.type, products),
        0,
      ) -
      remaining.length * gap;
    const center = Math.min(right, Math.max(left + half, fixture.t * trackL));
    placed.push({ ...fixture, t: center / trackL });
    left = center + half + gap;
  }
  return placed;
}
