export const FIXTURE_GAP = 0.08;
export const TRACK_EDGE = 0.02;

export type MountType = "surface" | "recessed";
export type FixtureShape = "spot" | "wide" | "line";
export type ProfileColor = "black" | "white";

export interface FixturePlacement {
  id: number;
  type: string;
  t: number;
  segmentId?: string;
}

export interface TrackPlacement {
  id: number;
  productId: string;
  color: ProfileColor;
  x: number;
  z: number;
  length: number;
  depth: number;
  tail: number;
  layoutId: string;
  fixtures: FixturePlacement[];
}

export interface Project {
  schemaVersion: 2;
  roomW: number;
  roomD: number;
  roomH: number;
  tracks: TrackPlacement[];
  activeTrackId: number | null;
  activeSegmentId: string;
  selectedFixture: { trackId: number; id: number } | null;
  kelvin: number;
  brightness: number;
  view: "3d" | "plan";
}

export type TrackDimension = "length" | "depth" | "tail";
export interface TrackSegmentDefinition {
  id: string;
  label: string;
  start: [
    Partial<Record<TrackDimension, number>>,
    Partial<Record<TrackDimension, number>>,
  ];
  end: [
    Partial<Record<TrackDimension, number>>,
    Partial<Record<TrackDimension, number>>,
  ];
}
export interface TrackLayout {
  id: string;
  name: string;
  parameters: {
    key: TrackDimension;
    label: string;
    min: number;
    max: number;
    default: number;
  }[];
  segments: TrackSegmentDefinition[];
}
export interface TrackProduct {
  id: string;
  name: string;
  description: string;
  mount: MountType;
  layoutIds: string[];
  requirements: {
    accessoryId: string;
    rule: "power" | "mount" | "end" | "straight" | "corner" | "tee" | "cross";
    spacing?: number;
    loadFactor?: number;
  }[];
  unitLength: number;
  price: number;
}

export interface LightProduct {
  id: string;
  name: string;
  type: string;
  shape: FixtureShape;
  width: number;
  watts: number;
  lumens: number;
  beam: number;
  price: number;
  imageUrl?: string;
}

export interface Catalog {
  layouts: TrackLayout[];
  tracks: TrackProduct[];
  fixtures: LightProduct[];
  accessories: {
    id: string;
    name: string;
    price: number;
    capacityWatts?: number;
  }[];
  demo: boolean;
}

export interface QuoteItem {
  kind: "track" | "fixture" | "accessory";
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  tracks: { id: number; length: number; requirements: QuoteItem[] }[];
  items: QuoteItem[];
  total: number;
  watts: number;
  lumens: number;
  trackCount: number;
  fixtureCount: number;
  demo: boolean;
}
