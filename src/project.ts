import { catalog, type FixturePlacement, type Project } from "../shared";
import { minimumTrackLength, placeFixtures } from "./placement";

export const DEFAULT_PROJECT: Project = {
  roomW: 5.2,
  roomD: 4,
  roomH: 2.8,
  trackX: 0,
  trackZ: 0,
  trackL: 3.2,
  mount: "surface",
  color: "black",
  kelvin: 3000,
  brightness: 85,
  fixtures: [
    { id: 1, type: "spot", t: 0.18 },
    { id: 2, type: "spot", t: 0.5 },
    { id: 3, type: "wide", t: 0.82 },
  ],
  selected: 2,
  view: "3d",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;

export function normalizeProject(value: unknown): Project | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.fixtures)) return null;
  const roomW = number(raw.roomW, DEFAULT_PROJECT.roomW, 2, 12);
  const roomD = number(raw.roomD, DEFAULT_PROJECT.roomD, 2, 12);
  const roomH = number(raw.roomH, DEFAULT_PROJECT.roomH, 2.2, 5);
  const trackL = number(raw.trackL, DEFAULT_PROJECT.trackL, 0.8, roomW - 0.4);
  const fixtures: FixturePlacement[] = [];
  let selected: number | null = null;
  for (const item of raw.fixtures.slice(0, 40) as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const fixture = item as Record<string, unknown>;
    const product = catalog.fixtures.find((entry) => entry.id === fixture.type);
    if (!product) continue;
    const id = fixtures.length + 1;
    fixtures.push({
      id,
      type: product.id,
      t: number(fixture.t, 0.5, 0.03, 0.97),
    });
    if (fixture.id === raw.selected) selected = id;
  }
  while (minimumTrackLength(fixtures) > trackL + 1e-8) fixtures.pop();
  const placed = placeFixtures(fixtures, trackL);
  return {
    roomW,
    roomD,
    roomH,
    trackL,
    trackX: number(
      raw.trackX,
      0,
      -(roomW - trackL) / 2 + 0.2,
      (roomW - trackL) / 2 - 0.2,
    ),
    trackZ: number(raw.trackZ, 0, -roomD / 2 + 0.35, roomD / 2 - 0.35),
    mount: raw.mount === "recessed" ? "recessed" : "surface",
    color: raw.color === "white" ? "white" : "black",
    kelvin: Math.round(number(raw.kelvin, 3000, 2700, 5000) / 100) * 100,
    brightness: Math.round(number(raw.brightness, 85, 10, 100) / 5) * 5,
    fixtures: placed,
    selected:
      raw.selected === null
        ? null
        : placed.some((fixture) => fixture.id === selected)
          ? selected
          : (placed[0]?.id ?? null),
    view: raw.view === "plan" ? "plan" : "3d",
  };
}

export function readSavedProject(): Project {
  try {
    return (
      normalizeProject(
        JSON.parse(localStorage.getItem("lights-prototype-v1") ?? "null"),
      ) ?? DEFAULT_PROJECT
    );
  } catch {
    return DEFAULT_PROJECT;
  }
}
