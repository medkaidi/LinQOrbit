import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

// Same geometry as the pitch deck cover, on a 100 × 100 grid shared by the SVG and the HTML nodes.
// The far orbits run past the square on purpose: the banner clips them and they fill its sides.
const OUTER = 48;
const MIDDLE = 33;
const INNER = 19;
const FAR = [68, 90, 114];

type Point = { x: number; y: number };

function at(radius: number, degrees: number): Point {
  const angle = (degrees * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
}

const CANDIDATE_LINKED = at(MIDDLE, 205);
const CANDIDATE_OTHER = at(MIDDLE, 140);
const OFFER_OTHER = at(MIDDLE, 320);
const OFFER_LINKED = at(MIDDLE, 28);

const NODES = [
  { point: CANDIDATE_LINKED, icon: "person", tone: "candidate" },
  { point: CANDIDATE_OTHER, icon: "person", tone: "candidate" },
  { point: OFFER_OTHER, icon: "work", tone: "offer" },
  { point: OFFER_LINKED, icon: "work", tone: "offer" },
] as const;

// Distant candidates and offers, kept out of the bottom-left corner where the banner card sits.
// Shown from `xl` only: on a narrower banner they would be sliced by its edges.
const FAR_LEFT_OFFER = at(FAR[0], 198);
const FAR_LEFT_CANDIDATE = at(FAR[1], 186);
const FAR_RIGHT_CANDIDATE = at(FAR[0], 338);
const FAR_RIGHT_OFFER = at(FAR[0], 20);

const FAR_NODES = [
  { point: FAR_LEFT_OFFER, icon: "work", tone: "offer" },
  { point: FAR_LEFT_CANDIDATE, icon: "person", tone: "candidate" },
  { point: FAR_RIGHT_CANDIDATE, icon: "person", tone: "candidate" },
  { point: FAR_RIGHT_OFFER, icon: "work", tone: "offer" },
] as const;

const FAR_LINKS: [Point, Point][] = [
  [FAR_LEFT_OFFER, CANDIDATE_LINKED],
  [FAR_LEFT_CANDIDATE, FAR_LEFT_OFFER],
  [FAR_RIGHT_CANDIDATE, OFFER_OTHER],
  [FAR_RIGHT_OFFER, OFFER_LINKED],
];

const NODE_TONE_CLASSES = {
  candidate: "bg-blue-surface border-blue-border text-blue-deep",
  offer: "bg-orange-subtle border-orange-border text-orange-deep",
} as const;

const OUTER_DOTS = [70, 110, 250, 290, 355].map((degrees) => at(OUTER, degrees));
const INNER_DOTS = [95, 265].map((degrees) => at(INNER, degrees));
const FAR_DOTS = [
  at(FAR[0], 172),
  at(FAR[0], 2),
  at(FAR[1], 206),
  at(FAR[1], 350),
  at(FAR[1], 14),
  at(FAR[2], 178),
  at(FAR[2], 186),
];

export function OrbitIllustration({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="LinQOrbit connects candidates with the right opportunities"
      className={cn("relative aspect-square @container", className)}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        overflow="visible"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        {FAR.map((radius) => (
          <circle key={radius} cx="50" cy="50" r={radius} className="stroke-slate-border" strokeWidth="0.3" />
        ))}
        <circle cx="50" cy="50" r={OUTER} className="stroke-slate-border" strokeWidth="0.3" />
        <circle cx="50" cy="50" r={MIDDLE} className="stroke-blue-border" strokeWidth="0.4" strokeDasharray="1.2 1.2" />
        <circle cx="50" cy="50" r={INNER} className="stroke-slate-border" strokeWidth="0.3" />

        {FAR_LINKS.map(([from, to]) => (
          <line
            key={`${from.x}-${to.x}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            className="hidden xl:inline stroke-slate-border-strong"
            strokeWidth="0.3"
            strokeDasharray="1 1"
          />
        ))}
        <line x1={CANDIDATE_OTHER.x} y1={CANDIDATE_OTHER.y} x2="50" y2="50" className="stroke-text-tertiary" strokeWidth="0.3" strokeDasharray="1 1" />
        <line x1={OFFER_OTHER.x} y1={OFFER_OTHER.y} x2="50" y2="50" className="stroke-text-tertiary" strokeWidth="0.3" strokeDasharray="1 1" />
        <line x1={CANDIDATE_LINKED.x} y1={CANDIDATE_LINKED.y} x2="50" y2="50" className="stroke-primary-container" strokeWidth="0.7" />
        <line x1="50" y1="50" x2={OFFER_LINKED.x} y2={OFFER_LINKED.y} className="stroke-primary-container" strokeWidth="0.7" />

        {[...OUTER_DOTS, ...FAR_DOTS].map((dot) => (
          <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="1" className="fill-text-tertiary" />
        ))}
        {INNER_DOTS.map((dot) => (
          <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="0.8" className="fill-blue-border" />
        ))}
      </svg>

      {FAR_NODES.map(({ point, icon, tone }) => (
        <span
          key={`${point.x}-${point.y}`}
          aria-hidden="true"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          className={cn(
            "absolute w-[7%] h-[7%] -translate-x-1/2 -translate-y-1/2 rounded-full border hidden xl:flex items-center justify-center opacity-60",
            NODE_TONE_CLASSES[tone],
          )}
        >
          <Icon name={icon} className="text-[3.5cqw]" />
        </span>
      ))}

      {NODES.map(({ point, icon, tone }) => (
        <span
          key={`${point.x}-${point.y}`}
          aria-hidden="true"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          className={cn(
            "absolute w-[11%] h-[11%] -translate-x-1/2 -translate-y-1/2 rounded-full border flex items-center justify-center",
            NODE_TONE_CLASSES[tone],
          )}
        >
          <Icon name={icon} className="text-[5.5cqw]" />
        </span>
      ))}

      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 w-[22%] h-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas-white border border-slate-border shadow-sm flex items-center justify-center"
      >
        <Logo className="w-[72%] h-auto" />
      </span>
    </div>
  );
}
