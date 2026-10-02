export type MountType = "surface" | "recessed";
export type FixtureType = "spot" | "wide" | "line";

export interface FixturePlacement {
  id: number;
  type: FixtureType;
  t: number;
}

export interface Project {
  roomW: number;
  roomD: number;
  roomH: number;
  trackX: number;
  trackZ: number;
  trackL: number;
  mount: MountType;
  color: "black" | "white";
  kelvin: number;
  brightness: number;
  fixtures: FixturePlacement[];
  selected: number | null;
  view: "3d" | "plan";
}

export interface TrackProduct {
  id: MountType;
  name: string;
  description: string;
  unitLength: number;
  price: number;
}

export interface LightProduct {
  id: FixtureType;
  name: string;
  type: string;
  watts: number;
  lumens: number;
  beam: number;
  price: number;
  icon: string;
}

export interface Catalog {
  tracks: TrackProduct[];
  fixtures: LightProduct[];
  accessories: { id: string; name: string; price: number; quantity: number }[];
  demo: boolean;
}

export interface QuoteItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  items: QuoteItem[];
  total: number;
  watts: number;
  lumens: number;
  fixtureCount: number;
  demo: boolean;
}

export const catalog: Catalog = {
  tracks: [
    {
      id: "surface",
      name: "Накладной трек 48V",
      description: "На поверхность потолка",
      unitLength: 1,
      price: 4200,
    },
    {
      id: "recessed",
      name: "Встроенный трек 48V",
      description: "Вровень с потолком",
      unitLength: 1,
      price: 5600,
    },
  ],
  fixtures: [
    {
      id: "spot",
      name: "SPOT 48",
      type: "Направленный",
      watts: 12,
      lumens: 900,
      beam: 36,
      price: 8900,
      icon: "◉",
    },
    {
      id: "wide",
      name: "WIDE 48",
      type: "Широкий луч",
      watts: 16,
      lumens: 1250,
      beam: 60,
      price: 10900,
      icon: "◍",
    },
    {
      id: "line",
      name: "LINE 48",
      type: "Линейный",
      watts: 20,
      lumens: 1600,
      beam: 100,
      price: 13900,
      icon: "▰",
    },
  ],
  accessories: [
    { id: "power", name: "Блок питания", price: 6900, quantity: 1 },
    { id: "connector", name: "Коннектор", price: 950, quantity: 2 },
  ],
  demo: true,
};

export function quote(input: unknown): Quote {
  if (!input || typeof input !== "object")
    throw new Error("Недопустимые параметры конфигурации");
  const request = input as Record<string, unknown>;
  const track = catalog.tracks.find((item) => item.id === request.mount);
  const length = request.trackL;
  if (
    !track ||
    typeof length !== "number" ||
    !Number.isFinite(length) ||
    length < 0.8 ||
    length > 12 ||
    !Array.isArray(request.fixtures) ||
    request.fixtures.length > 40
  ) {
    throw new Error("Недопустимые параметры конфигурации");
  }
  const fixtures: LightProduct[] = request.fixtures.map((raw: unknown) => {
    const type =
      raw && typeof raw === "object"
        ? (raw as Record<string, unknown>).type
        : null;
    const product = catalog.fixtures.find((item) => item.id === type);
    if (!product) throw new Error("Неизвестный светильник");
    return product;
  });
  const railCount = Math.ceil(length / track.unitLength);
  const items: QuoteItem[] = [
    {
      id: track.id,
      name: track.name,
      description: `Секции по ${track.unitLength} м`,
      quantity: railCount,
      unitPrice: track.price,
      total: railCount * track.price,
    },
  ];
  for (const product of catalog.fixtures) {
    const quantity = fixtures.filter((item) => item.id === product.id).length;
    if (quantity)
      items.push({
        id: product.id,
        name: product.name,
        description: `${product.type} · ${product.watts} Вт`,
        quantity,
        unitPrice: product.price,
        total: quantity * product.price,
      });
  }
  for (const accessory of catalog.accessories) {
    items.push({
      id: accessory.id,
      name: accessory.name,
      description: "Комплект подключения",
      quantity: accessory.quantity,
      unitPrice: accessory.price,
      total: accessory.quantity * accessory.price,
    });
  }
  return {
    items,
    total: items.reduce((sum, item) => sum + item.total, 0),
    watts: fixtures.reduce((sum, item) => sum + item.watts, 0),
    lumens: fixtures.reduce((sum, item) => sum + item.lumens, 0),
    fixtureCount: fixtures.length,
    demo: true,
  };
}
