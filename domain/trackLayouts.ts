import type {
  TrackLayout,
  TrackSegmentDefinition,
  TrackDimension,
} from "./types.js";
const zero = {};
const segment = (
  id: string,
  label: string,
  start: TrackSegmentDefinition["start"],
  end: TrackSegmentDefinition["end"],
): TrackSegmentDefinition => ({ id, label, start, end });
const parameter = (key: TrackDimension, label: string) => ({
  key,
  label,
  min: 0.8,
  max: 11.6,
  default: 2,
});
const width = parameter("length", "Ширина");
const depth = parameter("depth", "Глубина");
export const trackLayouts: TrackLayout[] = [
  {
    id: "line",
    name: "Линия",
    parameters: [parameter("length", "Длина")],
    segments: [segment("main", "Линия", [zero, zero], [{ length: 1 }, zero])],
  },
  {
    id: "corner",
    name: "Угол",
    parameters: [width, depth],
    segments: [
      segment("main", "Горизонталь", [zero, zero], [{ length: 1 }, zero]),
      segment(
        "side",
        "Вертикаль",
        [{ length: 1 }, zero],
        [{ length: 1 }, { depth: 1 }],
      ),
    ],
  },
  {
    id: "u",
    name: "П-форма",
    parameters: [width, depth],
    segments: [
      segment("main", "Верх", [zero, zero], [{ length: 1 }, zero]),
      segment("left", "Левая сторона", [zero, zero], [zero, { depth: 1 }]),
      segment(
        "right",
        "Правая сторона",
        [{ length: 1 }, zero],
        [{ length: 1 }, { depth: 1 }],
      ),
    ],
  },
  {
    id: "rectangle",
    name: "Прямоугольник",
    parameters: [width, depth],
    segments: [
      segment("main", "Верх", [zero, zero], [{ length: 1 }, zero]),
      segment(
        "right",
        "Правая сторона",
        [{ length: 1 }, zero],
        [{ length: 1 }, { depth: 1 }],
      ),
      segment(
        "bottom",
        "Низ",
        [zero, { depth: 1 }],
        [{ length: 1 }, { depth: 1 }],
      ),
      segment("left", "Левая сторона", [zero, zero], [zero, { depth: 1 }]),
    ],
  },
  {
    id: "parallel",
    name: "Две линии",
    parameters: [width, parameter("depth", "Расстояние между линиями")],
    segments: [
      segment("main", "Первая линия", [zero, zero], [{ length: 1 }, zero]),
      segment(
        "second",
        "Вторая линия",
        [zero, { depth: 1 }],
        [{ length: 1 }, { depth: 1 }],
      ),
    ],
  },
  {
    id: "z",
    name: "Z-форма",
    parameters: [
      parameter("length", "Верхний отрезок"),
      parameter("depth", "Вертикаль"),
      parameter("tail", "Нижний отрезок"),
    ],
    segments: [
      segment("main", "Верхний отрезок", [zero, zero], [{ length: 1 }, zero]),
      segment(
        "side",
        "Вертикаль",
        [{ length: 1 }, zero],
        [{ length: 1 }, { depth: 1 }],
      ),
      segment(
        "bottom",
        "Нижний отрезок",
        [{ length: 1 }, { depth: 1 }],
        [{ length: 1, tail: 1 }, { depth: 1 }],
      ),
    ],
  },
  {
    id: "t",
    name: "Т-форма",
    parameters: [width, depth],
    segments: [
      segment("main", "Левая часть", [zero, zero], [{ length: 0.5 }, zero]),
      segment(
        "right",
        "Правая часть",
        [{ length: 0.5 }, zero],
        [{ length: 1 }, zero],
      ),
      segment(
        "stem",
        "Ножка",
        [{ length: 0.5 }, zero],
        [{ length: 0.5 }, { depth: 1 }],
      ),
    ],
  },
  {
    id: "cross",
    name: "Крест",
    parameters: [width, depth],
    segments: [
      segment(
        "main",
        "Слева",
        [zero, { depth: 0.5 }],
        [{ length: 0.5 }, { depth: 0.5 }],
      ),
      segment(
        "right",
        "Справа",
        [{ length: 0.5 }, { depth: 0.5 }],
        [{ length: 1 }, { depth: 0.5 }],
      ),
      segment(
        "top",
        "Сверху",
        [{ length: 0.5 }, zero],
        [{ length: 0.5 }, { depth: 0.5 }],
      ),
      segment(
        "bottom",
        "Снизу",
        [{ length: 0.5 }, { depth: 0.5 }],
        [{ length: 0.5 }, { depth: 1 }],
      ),
    ],
  },
];
