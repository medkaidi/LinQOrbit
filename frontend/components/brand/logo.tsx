type LogoProps = {
  className?: string;
  title?: string;
  strokeScale?: number;
  orbitRotation?: number;
};

export function Logo({
  className,
  title = "LinQOrbit",
  strokeScale = 1,
  orbitRotation = 44,
}: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="300 360 200 190"
      width="200"
      height="190"
      className={className}
      role="img"
      aria-label={title}
    >
      <g transform="translate(400, 455)">
        <ellipse
          rx="112"
          ry="60"
          transform={`rotate(${-orbitRotation})`}
          stroke="#94A3B8"
          strokeWidth={5 * strokeScale}
          strokeLinecap="round"
          fill="none"
        />
        <ellipse
          rx="112"
          ry="60"
          transform={`rotate(${orbitRotation})`}
          stroke="#334155"
          strokeWidth={5 * strokeScale}
          strokeLinecap="round"
          fill="none"
        />
        <circle r="28" stroke="#F97316" strokeWidth={7.5 * strokeScale} fill="none" />
      </g>
    </svg>
  );
}
