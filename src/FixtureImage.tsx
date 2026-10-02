type FixtureImageProps = {
  type: string;
  className?: string;
};

/** Small product illustrations used wherever a fixture is listed. */
export default function FixtureImage({ type, className }: FixtureImageProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 52"
      role="img"
      aria-label={`Вид светильника ${type}`}
    >
      <defs>
        <linearGradient id={`body-${type}`} x2="0" y2="1">
          <stop stopColor="#707a73" />
          <stop offset="1" stopColor="#26332c" />
        </linearGradient>
      </defs>
      <rect x="27" y="4" width="18" height="6" rx="2" fill="#29352f" />
      {type === "line" ? (
        <>
          <rect x="32" y="10" width="8" height="5" fill="#38453d" />
          <rect
            x="6"
            y="15"
            width="60"
            height="24"
            rx="4"
            fill={`url(#body-${type})`}
          />
          <rect x="10" y="35" width="52" height="4" rx="2" fill="#e5d9b5" />
        </>
      ) : type === "wide" ? (
        <>
          <rect x="28" y="10" width="16" height="5" rx="2" fill="#38453d" />
          <path
            d="M22 16 Q36 12 50 16 L47 37 Q36 42 25 37 Z"
            fill={`url(#body-${type})`}
          />
          <ellipse cx="36" cy="38" rx="11" ry="4" fill="#c4c9b9" />
          <ellipse cx="36" cy="38" rx="8" ry="2.5" fill="#f5e9c7" />
        </>
      ) : (
        <>
          <rect x="31" y="10" width="10" height="6" rx="2" fill="#38453d" />
          <path
            d="M27 16 L45 16 L47 38 Q36 43 25 38 Z"
            fill={`url(#body-${type})`}
          />
          <ellipse cx="36" cy="38" rx="11" ry="4" fill="#151f19" />
          <ellipse cx="36" cy="38" rx="6" ry="2.5" fill="#e1dfcb" />
        </>
      )}
    </svg>
  );
}
