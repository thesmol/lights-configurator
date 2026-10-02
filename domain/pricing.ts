import { catalog } from "./demoCatalog.js";
import {
  FIXTURE_GAP,
  TRACK_EDGE,
  type Catalog,
  type Quote,
  type LightProduct,
  type QuoteItem,
  type TrackPlacement,
} from "./types.js";
import { trackSegments, usableLength } from "./trackGeometry.js";
import { requiredParts } from "./trackRequirements.js";

export function quote(input: unknown, source: Catalog = catalog): Quote {
  if (!input || typeof input !== "object")
    throw new Error("Недопустимые параметры конфигурации");
  const request = input as Record<string, unknown>;
  if (!Array.isArray(request.tracks) || request.tracks.length > 24)
    throw new Error("Недопустимые параметры конфигурации");
  const trackCounts = new Map<string, number>();
  const fixtures: LightProduct[] = [];
  const breakdowns: Quote["tracks"] = [];
  const accessories = new Map<string, QuoteItem>();
  for (const [index, raw] of request.tracks.entries()) {
    if (!raw || typeof raw !== "object") throw new Error("Недопустимый трек");
    const track = raw as Record<string, unknown>;
    const product = source.tracks.find((item) => item.id === track.productId);
    if (
      !product ||
      typeof track.length !== "number" ||
      !Number.isFinite(track.length) ||
      track.length < 0.8 ||
      track.length > 12 ||
      !Array.isArray(track.fixtures)
    )
      throw new Error("Недопустимый трек");
    const layoutId =
      typeof track.layoutId === "string" ? track.layoutId : "line";
    const layout = source.layouts.find((item) => item.id === layoutId);
    if (!layout) throw new Error("Неизвестная форма трека");
    if (!product.layoutIds.includes(layoutId))
      throw new Error("Профиль не поддерживает выбранную форму");
    for (const parameter of layout.parameters) {
      const value = track[parameter.key];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < parameter.min ||
        value > parameter.max
      )
        throw new Error(`Недопустимый размер: ${parameter.label}`);
    }
    const segments = trackSegments(
      {
        layoutId,
        length: track.length,
        depth: Number(track.depth ?? 2),
        tail: Number(track.tail ?? 2),
      },
      source.layouts,
    );
    trackCounts.set(
      product.id,
      (trackCounts.get(product.id) ?? 0) +
        segments.reduce(
          (sum, segment) =>
            sum + Math.ceil(segment.length / product.unitLength),
          0,
        ),
    );
    const occupied = new Map<string, { width: number; count: number }>();
    for (const item of track.fixtures) {
      const entry =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};
      const fixture = source.fixtures.find(
        (candidate) => candidate.id === entry.type,
      );
      if (!fixture) throw new Error("Неизвестный светильник");
      const segmentId =
        typeof entry.segmentId === "string" ? entry.segmentId : "main";
      if (!segments.some((segment) => segment.id === segmentId))
        throw new Error("Неизвестный участок трека");
      const previous = occupied.get(segmentId) ?? { width: 0, count: 0 };
      occupied.set(segmentId, {
        width: previous.width + fixture.width,
        count: previous.count + 1,
      });
      fixtures.push(fixture);
      if (fixtures.length > 200) throw new Error("Слишком много светильников");
    }
    for (const segment of segments) {
      const contents = occupied.get(segment.id);
      if (
        contents &&
        contents.width +
          TRACK_EDGE * 2 +
          Math.max(0, contents.count - 1) * FIXTURE_GAP >
          usableLength(segment) + 1e-8
      )
        throw new Error("Светильники не помещаются на участке трека");
    }
    const configured: TrackPlacement = {
      id: typeof track.id === "number" ? track.id : index + 1,
      productId: product.id,
      layoutId,
      length: track.length,
      depth: Number(track.depth ?? 2),
      tail: Number(track.tail ?? 2),
      x: 0,
      z: 0,
      color: "black",
      fixtures: track.fixtures.map((item, index) => ({
        id: index + 1,
        type: item.type,
        segmentId: item.segmentId ?? "main",
        t: 0.5,
      })),
    };
    const requirements = requiredParts(configured, product, source);
    breakdowns.push({
      id: configured.id,
      length: segments.reduce((sum, segment) => sum + segment.length, 0),
      requirements,
    });
    for (const item of requirements) {
      const previous = accessories.get(item.id);
      accessories.set(
        item.id,
        previous
          ? {
              ...previous,
              quantity: previous.quantity + item.quantity,
              total: previous.total + item.total,
            }
          : item,
      );
    }
  }
  const items: QuoteItem[] = [];
  for (const product of source.tracks) {
    const quantity = trackCounts.get(product.id) ?? 0;
    if (quantity)
      items.push({
        kind: "track",
        id: product.id,
        name: product.name,
        description: `Секции по ${product.unitLength} м`,
        quantity,
        unitPrice: product.price,
        total: quantity * product.price,
      });
  }
  for (const product of source.fixtures) {
    const quantity = fixtures.filter((item) => item.id === product.id).length;
    if (quantity)
      items.push({
        kind: "fixture",
        id: product.id,
        name: product.name,
        description: `${product.type} · ${product.watts} Вт`,
        quantity,
        unitPrice: product.price,
        total: quantity * product.price,
      });
  }
  items.push(...accessories.values());
  return {
    items,
    tracks: breakdowns,
    total: items.reduce((sum, item) => sum + item.total, 0),
    watts: fixtures.reduce((sum, item) => sum + item.watts, 0),
    lumens: fixtures.reduce((sum, item) => sum + item.lumens, 0),
    trackCount: request.tracks.length,
    fixtureCount: fixtures.length,
    demo: source.demo,
  };
}
