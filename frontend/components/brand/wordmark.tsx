export type WordmarkProps = {
  className?: string;
  title?: string;
};

const fontFamily = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

export function Wordmark({ className, title = "LinQOrbit" }: WordmarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="259.5 567.75 286.4 68.5"
      width="286.4"
      height="68.5"
      className={className}
      role="img"
      aria-label={title}
    >
      <g transform="translate(400, 620)">
        <text
          x="-56"
          y="0"
          textAnchor="end"
          fontFamily={fontFamily}
          fontWeight="700"
          fontSize="62"
          fill="#0F172A"
          letterSpacing="-0.03em"
        >
          Lin
        </text>
        <g transform="translate(-24, -20)">
          <circle r="26" stroke="#F97316" strokeWidth="4.5" fill="none" />
          <path
            d="M 12 12 Q 22 24 32 30"
            stroke="#F97316"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>
        <g transform="translate(14, -20)">
          <circle r="26" stroke="#0F172A" strokeWidth="4.5" fill="none" />
        </g>
        <text
          x="43"
          y="0"
          textAnchor="start"
          fontFamily={fontFamily}
          fontWeight="700"
          fontSize="62"
          fill="#0F172A"
          letterSpacing="-0.03em"
        >
          rbit
        </text>
      </g>
    </svg>
  );
}
