import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type SetStateAction,
} from "react";
import type { Catalog, Project } from "../shared";
import {
  fixturePoint,
  trackBounds,
  trackSegments,
  usableLength,
} from "../domain/trackGeometry";
import { tracksOverlap } from "./projectActions";
import FixtureGlyph from "./FixtureGlyph";
import { fixtureWidth, findFreePosition } from "./placement";

type Drag =
  | { kind: "fixture"; trackId: number; id: number }
  | {
      kind: "rail";
      trackId: number;
      startX: number;
      startY: number;
      x: number;
      z: number;
    };
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export default function Plan({
  project,
  catalog,
  setProject,
}: {
  project: Project;
  catalog: Catalog;
  setProject: Dispatch<SetStateAction<Project>>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 700, height: 500 });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (width && height)
        setSize((old) =>
          old.width === width && old.height === height
            ? old
            : { width, height },
        );
    });
    observer.observe(element);
    const stop = () => {
      drag.current = null;
    };
    window.addEventListener("pointerup", stop);
    return () => {
      observer.disconnect();
      window.removeEventListener("pointerup", stop);
    };
  }, []);
  const { width, height } = size,
    pad = Math.min(60, width * 0.1);
  const scale = Math.min(
    (width - pad * 2) / project.roomW,
    (height - pad * 2) / project.roomD,
  );
  const roomW = project.roomW * scale,
    roomD = project.roomD * scale,
    roomX = (width - roomW) / 2,
    roomY = (height - roomD) / 2;
  const start = (event: PointerEvent<SVGSVGElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const fixture = target?.closest(".plan-fixture"),
      rail = target?.closest(".rail-hit");
    if (!fixture && !rail) {
      setProject((current) => ({ ...current, selectedFixture: null }));
      return;
    }
    const trackId = Number((fixture ?? rail)?.getAttribute("data-track-id"));
    const track = project.tracks.find((track) => track.id === trackId);
    if (!track) return;
    event.preventDefault();
    event.currentTarget.focus();
    const segmentId =
      (fixture ?? rail)?.getAttribute("data-segment-id") ?? "main";
    drag.current = fixture
      ? {
          kind: "fixture",
          trackId,
          id: Number(fixture.getAttribute("data-fixture-id")),
        }
      : {
          kind: "rail",
          trackId,
          startX: event.clientX,
          startY: event.clientY,
          x: track.x,
          z: track.z,
        };
    setProject((current) => ({
      ...current,
      activeTrackId: trackId,
      activeSegmentId: segmentId,
      selectedFixture: fixture
        ? { trackId, id: Number(fixture.getAttribute("data-fixture-id")) }
        : null,
    }));
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const active = drag.current,
      bounds = host.current?.getBoundingClientRect();
    if (!active || !bounds) return;
    const mouseX = (event.clientX - bounds.left - width / 2) / scale,
      mouseZ = (event.clientY - bounds.top - height / 2) / scale;
    setProject((current) => {
      const track = current.tracks.find((track) => track.id === active.trackId);
      if (!track) return current;
      let next = track,
        activeSegmentId = current.activeSegmentId;
      if (active.kind === "fixture") {
        const fixture = track.fixtures.find((f) => f.id === active.id);
        if (!fixture) return current;
        const candidates = trackSegments(track, catalog.layouts)
          .map((segment) => {
            const dx = segment.x2 - segment.x1,
              dz = segment.z2 - segment.z1;
            const along = clamp(
              ((mouseX - track.x - segment.x1) * dx +
                (mouseZ - track.z - segment.z1) * dz) /
                segment.length ** 2,
              0,
              1,
            );
            return {
              segment,
              along,
              distance: Math.hypot(
                mouseX - track.x - segment.x1 - along * dx,
                mouseZ - track.z - segment.z1 - along * dz,
              ),
            };
          })
          .sort((a, b) => a.distance - b.distance);
        const closest = candidates[0];
        if (!closest) return current;
        const { segment, along } = closest;
        const t = findFreePosition(
          track.fixtures.filter(
            (f) =>
              f.id !== fixture.id && (f.segmentId ?? "main") === segment.id,
          ),
          usableLength(segment),
          fixture.type,
          (along * segment.length - segment.padding) / usableLength(segment),
          catalog.fixtures,
        );
        if (t === null) return current;
        next = {
          ...track,
          fixtures: track.fixtures.map((f) =>
            f.id === fixture.id ? { ...f, t, segmentId: segment.id } : f,
          ),
        };
        activeSegmentId = segment.id;
      } else {
        const footprint = trackBounds(track, catalog.layouts);
        next = {
          ...track,
          x: clamp(
            active.x + (event.clientX - active.startX) / scale,
            -(current.roomW - footprint.width) / 2 + 0.2,
            (current.roomW - footprint.width) / 2 - 0.2,
          ),
          z: clamp(
            active.z + (event.clientY - active.startY) / scale,
            -(current.roomD - footprint.depth) / 2 + 0.35,
            (current.roomD - footprint.depth) / 2 - 0.35,
          ),
        };
        if (current.tracks.some((other) => tracksOverlap(next, other, catalog)))
          return current;
      }
      return {
        ...current,
        activeSegmentId,
        tracks: current.tracks.map((track) =>
          track.id === next.id ? next : track,
        ),
      };
    });
  };
  return (
    <div id="plan-view" ref={host}>
      <svg
        tabIndex={0}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <pattern
            id="grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="#d8ddd7"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="#e8ebe5" />
        <rect
          x={roomX}
          y={roomY}
          width={roomW}
          height={roomD}
          fill="#fafaf6"
          stroke="#adb4a8"
          strokeWidth="2"
        />
        <rect
          x={roomX}
          y={roomY}
          width={roomW}
          height={roomD}
          fill="url(#grid)"
          opacity=".6"
        />
        <text x={roomX + 12} y={roomY + 25} className="plan-label">
          ПОТОЛОК · {project.roomW.toFixed(1)} × {project.roomD.toFixed(1)} М
        </text>
        {project.tracks.map((track, index) => {
          const segments = trackSegments(track, catalog.layouts),
            footprint = trackBounds(track, catalog.layouts);
          const cx = width / 2 + track.x * scale,
            cy = height / 2 + track.z * scale;
          const color = track.color === "black" ? "#202522" : "#a7b0a7";
          return (
            <g key={track.id}>
              <text
                x={cx - (footprint.width / 2) * scale}
                y={cy - (footprint.depth / 2) * scale - 16}
                className="plan-label"
                pointerEvents="none"
              >
                ТРЕК {index + 1}
              </text>
              {segments.map((segment) => {
                const selected =
                  project.activeTrackId === track.id &&
                  project.activeSegmentId === segment.id;
                const points = {
                  x1: cx + segment.x1 * scale,
                  x2: cx + segment.x2 * scale,
                  y1: cy + segment.z1 * scale,
                  y2: cy + segment.z2 * scale,
                };
                return (
                  <g key={segment.id}>
                    <line
                      {...points}
                      className="rail-hit"
                      data-track-id={track.id}
                      data-segment-id={segment.id}
                      stroke="transparent"
                      strokeWidth="24"
                    >
                      <title>
                        {segment.label} · Трек {index + 1}
                      </title>
                    </line>
                    <line
                      {...points}
                      stroke={selected ? "#8aaa69" : color}
                      strokeWidth={selected ? 12 : 9}
                      strokeLinecap="round"
                      pointerEvents="none"
                    />
                    <line
                      {...points}
                      stroke={color}
                      strokeWidth="7"
                      strokeLinecap="round"
                      pointerEvents="none"
                    />
                  </g>
                );
              })}
              {track.fixtures.map((fixture) => {
                const product = catalog.fixtures.find(
                  (item) => item.id === fixture.type,
                );
                const segment = segments.find(
                  (segment) => segment.id === (fixture.segmentId ?? "main"),
                );
                if (!segment) return null;
                const point = fixturePoint(segment, fixture.t),
                  w = fixtureWidth(fixture.type, catalog.fixtures) * scale;
                const h =
                  (product?.shape === "line"
                    ? 0.14
                    : fixtureWidth(fixture.type, catalog.fixtures)) * scale;
                const angle =
                  (Math.atan2(
                    segment.z2 - segment.z1,
                    segment.x2 - segment.x1,
                  ) *
                    180) /
                  Math.PI;
                return (
                  <g
                    key={fixture.id}
                    className="plan-fixture"
                    data-track-id={track.id}
                    data-fixture-id={fixture.id}
                    data-segment-id={segment.id}
                    transform={`translate(${cx + point.x * scale},${cy + point.z * scale}) rotate(${angle})`}
                  >
                    <title>
                      {product?.name ?? fixture.type} · {segment.label}
                    </title>
                    <FixtureGlyph
                      shape={product?.shape ?? "spot"}
                      color={track.color}
                      selected={
                        project.selectedFixture?.trackId === track.id &&
                        project.selectedFixture.id === fixture.id
                      }
                      x={-w / 2}
                      y={-h / 2}
                      width={w}
                      height={h}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
