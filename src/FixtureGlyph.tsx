import type { FixtureShape, ProfileColor } from "../shared";

interface FixtureGlyphProps {
  shape: FixtureShape;
  color?: ProfileColor;
  selected?: boolean;
  className?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export default function FixtureGlyph({
  shape,
  color = "black",
  selected = false,
  className,
  x,
  y,
  width,
  height,
}: FixtureGlyphProps) {
  const body = color === "black" ? "#26302c" : "#dce1db";
  const edge = selected ? "#7e9f58" : color === "black" ? "#111b17" : "#8d9990";
  return (
    <svg
      className={className}
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox="0 0 48 48"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {shape === "line" ? (
        <>
          <rect
            x="2"
            y="13"
            width="44"
            height="22"
            rx="4"
            fill={body}
            stroke={edge}
            strokeWidth={selected ? 4 : 2}
          />
          <rect x="6" y="20" width="36" height="8" rx="2" fill="#fff6dc" />
        </>
      ) : (
        <>
          <circle
            cx="24"
            cy="24"
            r={shape === "wide" ? 21 : 18}
            fill={body}
            stroke={edge}
            strokeWidth={selected ? 4 : 2}
          />
          <circle
            cx="24"
            cy="24"
            r={shape === "wide" ? 15 : 12}
            fill="#e7e8df"
            stroke="#9da99e"
            strokeWidth="2"
          />
          <circle
            cx="24"
            cy="24"
            r={shape === "wide" ? 10 : 6}
            fill={shape === "wide" ? "#f9f3df" : "#acb8ad"}
          />
        </>
      )}
    </svg>
  );
}
