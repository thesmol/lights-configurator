import type {
  Catalog,
  QuoteItem,
  TrackPlacement,
  TrackProduct,
} from "./types.js";
import { trackSegments } from "./trackGeometry.js";

/** Counts topology and assembly parts from the actual segments, not a shape name. */
export function requiredParts(
  track: TrackPlacement,
  product: TrackProduct,
  catalog: Catalog,
): QuoteItem[] {
  const segments = trackSegments(track, catalog.layouts);
  const nodes = new Map<
    string,
    Array<{ segmentId: string; dx: number; dz: number }>
  >();
  const key = (x: number, z: number) => `${x.toFixed(6)},${z.toFixed(6)}`;
  for (const segment of segments) {
    for (const [x, z, dx, dz] of [
      [
        segment.x1,
        segment.z1,
        segment.x2 - segment.x1,
        segment.z2 - segment.z1,
      ],
      [
        segment.x2,
        segment.z2,
        segment.x1 - segment.x2,
        segment.z1 - segment.z2,
      ],
    ]) {
      const id = key(x, z),
        edges = nodes.get(id) ?? [];
      edges.push({ segmentId: segment.id, dx, dz });
      nodes.set(id, edges);
    }
  }
  const counts = {
    end: 0,
    corner: 0,
    straight: segments.reduce(
      (sum, s) =>
        sum + Math.max(0, Math.ceil(s.length / product.unitLength) - 1),
      0,
    ),
    tee: 0,
    cross: 0,
  };
  for (const edges of nodes.values()) {
    if (edges.length === 1) counts.end++;
    else if (edges.length === 2) {
      if (
        Math.abs(edges[0].dx * edges[1].dz - edges[0].dz * edges[1].dx) < 1e-6
      )
        counts.straight++;
      else counts.corner++;
    } else if (edges.length === 3) counts.tee++;
    else if (edges.length === 4) counts.cross++;
  }
  // Each disconnected circuit requires a feed, even if no fixtures are placed yet.
  const components: Set<string>[] = [];
  const visited = new Set<string>();
  for (const segment of segments) {
    if (visited.has(segment.id)) continue;
    const component = new Set<string>(),
      pending = [segment.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      component.add(id);
      for (const edges of nodes.values())
        if (edges.some((edge) => edge.segmentId === id))
          for (const edge of edges)
            if (!visited.has(edge.segmentId)) pending.push(edge.segmentId);
    }
    components.push(component);
  }
  return product.requirements
    .map((rule) => {
      const accessory = catalog.accessories.find(
        (item) => item.id === rule.accessoryId,
      );
      if (!accessory)
        throw new Error(
          `Не задана обязательная комплектующая: ${rule.accessoryId}`,
        );
      let quantity: number;
      if (rule.rule === "mount")
        quantity = segments.reduce(
          (sum, segment) =>
            sum + Math.ceil(segment.length / (rule.spacing ?? 0.6)) + 1,
          0,
        );
      else if (rule.rule === "power") {
        const capacity = accessory.capacityWatts;
        if (!capacity || capacity <= 0)
          throw new Error("Не задана мощность блока питания");
        quantity = components.reduce((sum, component) => {
          const watts = track.fixtures
            .filter((f) => component.has(f.segmentId ?? "main"))
            .reduce(
              (load, fixture) =>
                load +
                (catalog.fixtures.find((item) => item.id === fixture.type)
                  ?.watts ?? 0),
              0,
            );
          return (
            sum +
            Math.max(
              1,
              Math.ceil((watts * (rule.loadFactor ?? 1.2)) / capacity),
            )
          );
        }, 0);
      } else quantity = counts[rule.rule];
      return {
        kind: "accessory" as const,
        id: accessory.id,
        name: accessory.name,
        description:
          rule.rule === "power"
            ? `Питание ${accessory.capacityWatts} Вт · резерв ${Math.round(((rule.loadFactor ?? 1.2) - 1) * 100)}%`
            : rule.rule === "mount"
              ? `Шаг крепления до ${rule.spacing ?? 0.6} м`
              : "Обязательная комплектация",
        quantity,
        unitPrice: accessory.price,
        total: quantity * accessory.price,
      };
    })
    .filter((item) => item.quantity > 0);
}
