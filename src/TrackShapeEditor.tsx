import type { Catalog, Project, TrackPlacement, TrackLayout } from "../shared";
import {
  trackBounds,
  trackSegments,
  trackLength,
} from "../domain/trackGeometry";
import { reshapeTrack } from "./projectActions";

function layoutPatch(
  project: Project,
  track: TrackPlacement,
  layout: TrackLayout,
  catalog: Catalog,
): Partial<TrackPlacement> {
  const next = { ...track, layoutId: layout.id };
  for (const parameter of layout.parameters)
    next[parameter.key] = parameter.default;
  const bounds = trackBounds(next, catalog.layouts);
  const factor = Math.min(
    1,
    (project.roomW - 0.4) / Math.max(0.01, bounds.width),
    (project.roomD - 0.7) / Math.max(0.01, bounds.depth),
  );
  for (const parameter of layout.parameters)
    next[parameter.key] = Math.max(
      parameter.min,
      Math.floor(next[parameter.key] * factor * 10) / 10,
    );
  return {
    layoutId: next.layoutId,
    length: next.length,
    depth: next.depth,
    tail: next.tail,
  };
}
export default function TrackShapeEditor({
  project,
  track,
  catalog,
  onChange,
  onReject,
  onSelectSegment,
}: {
  project: Project;
  track: TrackPlacement;
  catalog: Catalog;
  onChange: (project: Project) => void;
  onReject: () => void;
  onSelectSegment: (id: string) => void;
}) {
  const layout = catalog.layouts.find((layout) => layout.id === track.layoutId);
  const apply = (patch: Partial<TrackPlacement>) => {
    const result = reshapeTrack(project, track.id, patch, catalog);
    if (result) onChange(result);
    else onReject();
  };
  return (
    <div className="mb-5 grid gap-3">
      <div className="text-[11px] font-bold text-[#4c5b4f]">Форма трека</div>
      <div className="grid grid-cols-4 gap-1.5">
        {catalog.layouts
          .filter((option) =>
            catalog.tracks
              .find((product) => product.id === track.productId)
              ?.layoutIds.includes(option.id),
          )
          .map((option) => {
            const preview = {
              ...track,
              length: 2,
              depth: 2,
              tail: 2,
              layoutId: option.id,
            };
            const segments = trackSegments(preview, catalog.layouts);
            const bounds = trackBounds(preview, catalog.layouts);
            const scale = 32 / Math.max(bounds.width, bounds.depth, 0.1);
            const patch = layoutPatch(project, track, option, catalog);
            const valid =
              option.id === track.layoutId ||
              !!reshapeTrack(project, track.id, patch, catalog);
            return (
              <button
                key={option.id}
                type="button"
                aria-label={`Форма: ${option.name}`}
                aria-pressed={option.id === track.layoutId}
                disabled={!valid}
                title={
                  valid
                    ? option.name
                    : "Не помещается в комнате или недостаточно места для приборов"
                }
                className={`grid place-items-center rounded border px-1 py-2 text-[9px] disabled:opacity-35 ${option.id === track.layoutId ? "border-[#8aaa69] bg-[#e9f0df]" : "border-[#e6eae1] bg-[#f6f8f2]"}`}
                onClick={() => apply(patch)}
              >
                <svg
                  viewBox="0 0 48 36"
                  className="mb-1 h-7 w-10"
                  aria-hidden="true"
                >
                  {segments.map((segment) => (
                    <line
                      key={segment.id}
                      x1={24 + segment.x1 * scale}
                      x2={24 + segment.x2 * scale}
                      y1={18 + segment.z1 * scale}
                      y2={18 + segment.z2 * scale}
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  ))}
                </svg>
                {option.name}
              </button>
            );
          })}
      </div>
      {layout?.parameters.map((parameter) => (
        <div key={parameter.key} className="track-length">
          <label htmlFor={`track-${parameter.key}`}>
            {parameter.label}
            <strong>{track[parameter.key].toFixed(1)} м</strong>
          </label>
          <input
            id={`track-${parameter.key}`}
            type="range"
            min={parameter.min}
            max={Math.min(
              parameter.max,
              parameter.key === "depth"
                ? project.roomD - 0.7
                : project.roomW - 0.4,
            )}
            step="0.1"
            value={track[parameter.key]}
            onChange={(event) =>
              apply({ [parameter.key]: Number(event.target.value) })
            }
          />
        </div>
      ))}
      <p className="text-[10px] text-[#829075]">
        Общая длина: {trackLength(track, catalog.layouts).toFixed(1)} м
      </p>
      {layout && layout.segments.length > 1 && (
        <div>
          <div className="mb-2 text-[11px] font-bold text-[#4c5b4f]">
            Участок для добавления света
          </div>
          <div className="flex flex-wrap gap-1">
            {layout.segments.map((segment) => (
              <button
                key={segment.id}
                aria-pressed={project.activeSegmentId === segment.id}
                className={`rounded px-2 py-1.5 text-[10px] ${project.activeSegmentId === segment.id ? "bg-[#dfe9d5]" : "bg-[#f2f4ed]"}`}
                onClick={() => onSelectSegment(segment.id)}
              >
                {segment.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
