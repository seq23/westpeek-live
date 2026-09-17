import { SPEED_NETWORKING_DEFAULT_MINUTES } from "@/types/speedNetworking";

/**
 * A round, drawn: two tiles side by side, a figure in each, a timer running down.
 *
 * The cycle diagram explains the SEQUENCE — match, talk, pause, again. It could not answer the
 * owner's question (17 Sep 2026): "there are no drawings or anything of people doing a 1:1 chat —
 * even the gray person placeholder? to show visually a 2x1 of how it works?" Somebody who has
 * never done speed networking can follow the sequence and still not picture the thing they are
 * about to be put into. This is that picture, and it is deliberately the only one: two equal
 * tiles, cameras on, a countdown, two captions, nothing else in the frame.
 *
 * It is a drawing of the REAL room, not a generic illustration. Everything in it mirrors what
 * SpeedNetworkingLive actually renders: PairStage's two equal tiles in a `grid-cols-2` at every
 * width, the partner on the left and you on the right, each tile's caption on a gradient strip
 * along its bottom edge, and MatchRoom's black "Time left" pill with an mm:ss countdown. If the
 * room ever stops looking like this, this drawing is wrong and must be redrawn.
 *
 * NO PHOTOGRAPHS OF PEOPLE, ever — the rule the explainer beside it already carries. A stock
 * photograph here is a stranger presented as an attendee of this event. The figures are the plain
 * grey placeholder silhouette, which carries no likeness, names nobody, and needs no asset.
 *
 * The countdown bar is the page's one piece of looping motion, and it is a picture of the timer
 * rather than decoration. `prefers-reduced-motion` holds it still, part-spent, in globals.css.
 */
export function SpeedNetworkingPairDrawing({ matchMinutes = SPEED_NETWORKING_DEFAULT_MINUTES }: { matchMinutes?: number }) {
  const minutes = Number.isFinite(matchMinutes) && matchMinutes > 0 ? Math.round(matchMinutes) : SPEED_NETWORKING_DEFAULT_MINUTES;
  // The clock in the drawing reads a little under the full round, so it reads as a round in
  // progress rather than one that has not started. Derived from the real length, never typed in.
  const shown = `${Math.max(0, minutes - 1)}:47`;

  return (
    <figure className="m-0" data-testid="speed-networking-pair-drawing" data-match-minutes={minutes}>
      <svg
        viewBox="0 0 600 330"
        role="img"
        aria-labelledby="wpl-net-pair-title"
        className="h-auto w-full"
      >
        <title id="wpl-net-pair-title">
          {`A drawing of one round: two video tiles side by side, your match on the left and you on the right, each with a person in it, and a timer counting down ${minutes} minutes.`}
        </title>
        <defs>
          <linearGradient id="wpl-net-caption" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#050505" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#050505" stopOpacity="0" />
          </linearGradient>
          <clipPath id="wpl-net-tile-left"><rect x="20" y="86" width="270" height="152" rx="16" /></clipPath>
          <clipPath id="wpl-net-tile-right"><rect x="310" y="86" width="270" height="152" rx="16" /></clipPath>
        </defs>

        {/* The room itself: the black surround the two tiles actually sit in. */}
        <rect x="0" y="0" width="600" height="330" rx="24" fill="#050505" />

        {/* Header row. The room itself says "You are matched"; the DRAWING says what it is a drawing
            of, because a reader who has not joined anything must never think they already have. */}
        <text x="20" y="42" fontSize="13" fontWeight="800" letterSpacing="2.4" fill="#f05a1a">WHAT A ROUND LOOKS LIKE</text>
        <rect x="446" y="18" width="134" height="48" rx="14" fill="#171717" />
        <text x="513" y="37" textAnchor="middle" fontSize="10" fontWeight="800" letterSpacing="1.2" fill="#73706a">TIME LEFT</text>
        <text x="513" y="57" textAnchor="middle" fontSize="19" fontWeight="800" fill="#ffffff" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{shown}</text>

        {/* Two tiles, equal, side by side — exactly what PairStage renders at every width. */}
        <PairTile x={20} clip="wpl-net-tile-left" caption="Your match" />
        <PairTile x={310} clip="wpl-net-tile-right" caption="You" />

        {/* The round running out. One loop, and it is the timer, not an ornament. */}
        <rect x="20" y="258" width="560" height="6" rx="3" fill="#171717" />
        <g transform="translate(20 258)">
          <rect className="wpl-countdown-bar" width="560" height="6" rx="3" fill="#f05a1a" />
        </g>
        <text x="20" y="294" fontSize="14" fontWeight="800" fill="#ffffff">{`${minutes} minutes, then you are both back in the queue`}</text>
        <text x="20" y="314" fontSize="13" fill="#73706a">Two tiles, two people, one timer. Nobody else can be in the room.</text>
      </svg>
      <figcaption className="sr-only">
        {`One round of speed networking: a two-up video call with a single other attendee for ${minutes} minutes, with a countdown, after which you are both returned to the queue.`}
      </figcaption>
    </figure>
  );
}

/** One tile: the picture area, the grey placeholder figure, and the caption strip along the bottom. */
function PairTile({ x, clip, caption }: { x: number; clip: string; caption: string }) {
  return (
    <g>
      <rect x={x} y={86} width={270} height={152} rx={16} fill="#171717" stroke="#2a2a2a" strokeWidth={1} />
      <g clipPath={`url(#${clip})`}>
        {/* The plain grey placeholder: a head and a pair of shoulders. No likeness, nobody real. */}
        <circle cx={x + 135} cy={150} r={30} fill="#73706a" />
        <path d={`M ${x + 135 - 58} 238 a 58 50 0 0 1 116 0 z`} fill="#73706a" />
        <rect x={x} y={202} width={270} height={36} fill={`url(#wpl-net-caption)`} />
      </g>
      <text x={x + 12} y={228} fontSize="13" fontWeight="800" fill="#ffffff">{caption}</text>
    </g>
  );
}
