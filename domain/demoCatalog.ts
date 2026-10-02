import type { Catalog } from "./types.js";
import { trackLayouts } from "./trackLayouts.js";

export const catalog: Catalog = {
  layouts: trackLayouts,
  tracks: [
    {
      id: "surface",
      name: "Накладной трек 48V",
      description: "На поверхность потолка",
      mount: "surface",
      layoutIds: trackLayouts.map((layout) => layout.id),
      requirements: [
        { accessoryId: "power", rule: "power", loadFactor: 1.2 },
        { accessoryId: "surface-end", rule: "end" },
        { accessoryId: "surface-join", rule: "straight" },
        { accessoryId: "surface-corner", rule: "corner" },
        { accessoryId: "surface-tee", rule: "tee" },
        { accessoryId: "surface-cross", rule: "cross" },
        { accessoryId: "surface-mount", rule: "mount", spacing: 0.6 },
      ],
      unitLength: 1,
      price: 4200,
    },
    {
      id: "recessed",
      name: "Встроенный трек 48V",
      description: "Вровень с потолком",
      mount: "recessed",
      layoutIds: trackLayouts.map((layout) => layout.id),
      requirements: [
        { accessoryId: "power", rule: "power", loadFactor: 1.2 },
        { accessoryId: "recessed-end", rule: "end" },
        { accessoryId: "recessed-join", rule: "straight" },
        { accessoryId: "recessed-corner", rule: "corner" },
        { accessoryId: "recessed-tee", rule: "tee" },
        { accessoryId: "recessed-cross", rule: "cross" },
        { accessoryId: "recessed-mount", rule: "mount", spacing: 0.5 },
      ],
      unitLength: 1,
      price: 5600,
    },
  ],
  fixtures: [
    {
      id: "spot",
      name: "SPOT 48",
      type: "Направленный",
      shape: "spot",
      width: 0.16,
      watts: 12,
      lumens: 900,
      beam: 36,
      price: 8900,
    },
    {
      id: "wide",
      name: "WIDE 48",
      type: "Широкий луч",
      shape: "wide",
      width: 0.2,
      watts: 16,
      lumens: 1250,
      beam: 60,
      price: 10900,
    },
    {
      id: "line",
      name: "LINE 48",
      type: "Линейный",
      shape: "line",
      width: 0.38,
      watts: 20,
      lumens: 1600,
      beam: 100,
      price: 13900,
    },
  ],
  accessories: [
    {
      id: "power",
      name: "Блок питания 48V / 100 Вт",
      price: 6900,
      capacityWatts: 100,
    },
    ...(["surface", "recessed"] as const).flatMap((mount, index) => [
      {
        id: `${mount}-end`,
        name: `Заглушка ${mount === "surface" ? "накладного" : "встроенного"} трека`,
        price: 250 + index * 100,
      },
      {
        id: `${mount}-join`,
        name: "Прямой соединитель",
        price: 950 + index * 150,
      },
      {
        id: `${mount}-corner`,
        name: "Угловой соединитель",
        price: 1400 + index * 200,
      },
      { id: `${mount}-tee`, name: "Т-соединитель", price: 1900 + index * 200 },
      {
        id: `${mount}-cross`,
        name: "Х-соединитель",
        price: 2400 + index * 200,
      },
      {
        id: `${mount}-mount`,
        name:
          mount === "surface" ? "Монтажное крепление" : "Пружинный фиксатор",
        price: 150 + index * 50,
      },
    ]),
  ],
  demo: true,
};
