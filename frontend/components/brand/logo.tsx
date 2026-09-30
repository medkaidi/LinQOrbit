export type LogoProps = {
  className?: string;
  title?: string;
};

export function Logo({ className, title = "LinQOrbit" }: LogoProps) {
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
          transform="rotate(-42)"
          stroke="#94A3B8"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse
          rx="112"
          ry="60"
          transform="rotate(42)"
          stroke="#0F172A"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <circle r="28" stroke="#F97316" strokeWidth="4.5" fill="none" />
      </g>
    </svg>
  );
}
