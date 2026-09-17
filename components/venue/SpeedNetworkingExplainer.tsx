import type { ReactNode } from "react";
import { SPEED_NETWORKING_CYCLE, SPEED_NETWORKING_DEFAULT_MINUTES } from "@/types/speedNetworking";
import { SPEED_NETWORKING_ROOM_CAPACITY } from "@/services/speed-networking/speedNetworkingRoomGuard";
import { SPEED_NETWORKING_MATCHING_CONFIG } from "@/services/speed-networking/speedNetworkingTiers";
import { SpeedNetworkingPairDrawing } from "./SpeedNetworkingPairDrawing";

/**
 * What speed networking actually is, before anyone presses the button — and the page that has to
 * make them want to.
 *
 * The page used to say "Meet other attendees, one at a time." over a Join queue button, which
 * assumes the reader has done this before. Somebody who has not is being asked to agree to
 * something they cannot picture, and the honest description ("four minutes on camera with one
 * person you have not met, then it moves you on") is the difference between hesitating and
 * pressing it (the owner, 17 Sep 2026).
 *
 * Then the explanation grew and buried the thing it was selling. The owner walked the page the
 * same day: "why do i have to scroll to join the queue and why is it at the bottom and seem so
 * muted!?" — the reader met the promise, believed it, and then had to scroll past a diagram, four
 * cards, a privacy line and a register box to act on it. So the page is now ordered the way the
 * decision is made rather than the way the subject is taught:
 *
 *   1. the promise, at the size it deserves    (SpeedNetworkingHero's headline)
 *   2. THE ACTION, with the privacy promise beside it, above the fold at laptop and phone widths
 *   3. the picture of a round — two tiles, two people, a timer
 *   4. the loop, and then the four hesitations, for whoever wants them
 *
 * Steps 1-3 are one black hero surface, which is what makes the white action card in the middle of
 * it unmissable; 4 is white cards on the warm ground below. Black and white first, orange only on
 * the thing to press and the words that matter — WEST_PEEK_BRAND_SYSTEM.md, which is locked.
 *
 * Every number here is read from the code that enforces it rather than typed into the copy:
 * the round length from the event's own setting (SPEED_NETWORKING_DEFAULT_MINUTES when it has not
 * been changed), the pause from SPEED_NETWORKING_CYCLE.setupGapSeconds, the room size from the
 * guard's own capacity constant, and the matching claims from SPEED_NETWORKING_MATCHING_CONFIG —
 * which has its own fairness-contract validator. If somebody retunes the cycle, this page changes
 * with it instead of quietly becoming a false promise. A design change may never turn one of these
 * into a literal.
 *
 * NO PHOTOGRAPHS OF PEOPLE, ever. A stock photograph on this page is a stranger presented as an
 * attendee of this event. Everything drawn here is SVG: it carries no likeness, needs no asset,
 * and explains the loop better than a picture of a smiling person in a headset.
 */

const SHARED = SPEED_NETWORKING_MATCHING_CONFIG;

function roundMinutes(matchMinutes: number | undefined) {
  return Number.isFinite(matchMinutes) && (matchMinutes as number) > 0 ? Math.round(matchMinutes as number) : SPEED_NETWORKING_DEFAULT_MINUTES;
}

/**
 * The top of the page: the promise, the action, the picture. One black surface so the eye goes
 * headline → button → picture, in that order, without being decorated at.
 *
 * `children` is the action — the real queue panel, in whatever state this attendee is in. It sits
 * INSIDE the hero, immediately under the opening paragraph, because that is the moment the reader
 * decides. It is given the full width of the hero rather than a column beside the drawing: a
 * matched attendee's 1:1 video room renders through this same slot and must not be squeezed.
 */
export function SpeedNetworkingHero({ matchMinutes = SPEED_NETWORKING_DEFAULT_MINUTES, children }: { matchMinutes?: number; children: ReactNode }) {
  const minutes = roundMinutes(matchMinutes);
  return (
    <section
      className="overflow-hidden rounded-brand bg-brand-black px-5 py-7 shadow-brand sm:px-8 sm:py-10"
      data-testid="speed-networking-hero"
      data-match-minutes={minutes}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-orange">Speed networking</p>
      <h2 className="mt-3 max-w-3xl text-[1.75rem] font-black leading-[1.08] tracking-[-0.035em] text-brand-white sm:text-4xl lg:text-5xl">
        {minutes} minutes on camera with one person you have not met.{" "}
        <span className="text-brand-orange">Then it moves you on.</span>
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-6 text-brand-line sm:text-base sm:leading-7">
        You join a queue, not a meeting. When a match is found you are put straight into a video call with one other
        person. When the timer runs out you both go back in, and it happens again with somebody new.
      </p>

      {/* The action. Immediately under the paragraph, above the fold, nothing between. */}
      <div className="mt-6 sm:mt-7" data-testid="speed-networking-action-slot">{children}</div>

      {/* The picture of a round, after the decision rather than in front of it. */}
      <div className="mt-8 max-w-[600px] sm:mt-10">
        <SpeedNetworkingPairDrawing matchMinutes={minutes} />
      </div>
    </section>
  );
}

/**
 * The detail, for whoever wants it: the loop drawn, then the four hesitations answered. Below the
 * action on purpose — nobody should have to read any of it to press the button.
 */
export function SpeedNetworkingExplainer({ matchMinutes = SPEED_NETWORKING_DEFAULT_MINUTES }: { matchMinutes?: number }) {
  const minutes = roundMinutes(matchMinutes);
  const pause = SPEED_NETWORKING_CYCLE.setupGapSeconds;

  /**
   * Four answers to four different hesitations, so they read as four answers rather than four
   * identical rectangles: each carries the question it settles, its own drawn glyph, and the one
   * that answers "who am I going to be stuck with" is given the width of the row.
   */
  const facts: Array<{ question: string; title: string; body: string; glyph: Glyph; wide?: boolean; lead?: boolean }> = [
    {
      question: "Who am I talking to?",
      glyph: "pair",
      title: `${minutes} minutes, one other person`,
      body: `A video call with exactly one other person, cameras and microphones on, with a timer counting down. The room holds ${SPEED_NETWORKING_ROOM_CAPACITY === 2 ? "two people and only two" : `${SPEED_NETWORKING_ROOM_CAPACITY} people`}, so nobody can walk in on it.`,
      // The hesitation that actually stops people. It opens the row, and it is the ONE card given
      // the soft tint — orange is sparse here or it stops meaning anything.
      wide: true,
      lead: true,
    },
    {
      question: "How are we paired?",
      glyph: "shuffle",
      title: "Someone you have not met",
      body: `You are never paired with the same person twice${SHARED.blockSameCompany ? ", and never with someone from your own organisation" : ""}. When few people are waiting it is simply whoever has waited longest; when the room is busy it looks at the topics you both care about and at who wants opposite sides of the same conversation, someone hiring and someone looking, say, with waiting time weighted heavily enough that nobody is left out in favour of a better pairing.`,
    },
    {
      question: "What happens between calls?",
      glyph: "pause",
      title: `A ${pause}-second pause`,
      body: "When a call ends you are not dropped straight into the next one. There is a short beat that shows who you are about to meet and gives you your own camera preview back, so you arrive ready rather than mid-sentence.",
    },
    {
      question: "How do I get out?",
      glyph: "leave",
      wide: true,
      title: "It keeps going until you leave",
      body: "One call ends, the next is found, and round follows round for as long as you stay. Leaving is one button and takes effect immediately; nothing is scheduled and you do not have to sign up for a slot.",
    },
  ];

  return (
    <section className="space-y-4" data-testid="speed-networking-explainer" data-match-minutes={minutes} data-setup-gap-seconds={pause}>
      <div className="rounded-brand border border-brand-line bg-brand-white p-5 sm:p-7">
        <h3 className="text-lg font-black tracking-[-0.02em] text-brand-black sm:text-xl">And then it comes round again</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
          One round is the picture above. This is what the rest of the hour looks like.
        </p>
        <CycleDiagram minutes={minutes} pause={pause} />
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        {facts.map((fact) => (
          <div
            key={fact.title}
            className={`rounded-brand border p-5 ${fact.lead ? "border-brand-orange/50 bg-brand-orangeSoft" : "border-brand-line bg-brand-white"}${fact.wide ? " sm:col-span-2" : ""}`}
            data-testid="speed-networking-answer"
          >
            <div className="flex items-start gap-3">
              <FactGlyph glyph={fact.glyph} />
              <div>
                <dt className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-orange">{fact.question}</dt>
                <p className="mt-1.5 text-base font-black tracking-[-0.01em] text-brand-black">{fact.title}</p>
                <dd className="mt-1 text-sm leading-6 text-brand-muted">{fact.body}</dd>
              </div>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

type Glyph = "pair" | "shuffle" | "pause" | "leave";

/**
 * A small drawn mark per answer. Line work only, one weight, brand orange on the warm tint — it is
 * there so the four cards are told apart at a glance, not so the page has pictures on it.
 */
function FactGlyph({ glyph }: { glyph: Glyph }) {
  const paths: Record<Glyph, ReactNode> = {
    pair: <><circle cx="7" cy="9" r="2.6" /><path d="M2.5 19a4.5 4.5 0 0 1 9 0" /><circle cx="17" cy="9" r="2.6" /><path d="M12.5 19a4.5 4.5 0 0 1 9 0" /></>,
    shuffle: <><path d="M3 7h4l10 10h4" /><path d="M3 17h4l10 -10h4" /><path d="M18 4l3 3l-3 3" /><path d="M18 14l3 3l-3 3" /></>,
    pause: <><path d="M9 6v12" /><path d="M15 6v12" /></>,
    leave: <><path d="M14 4H6a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h8" /><path d="M11 12h10" /><path d="M17 8l4 4l-4 4" /></>,
  };
  return (
    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-black" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#f05a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paths[glyph]}
      </svg>
    </span>
  );
}

/**
 * The loop, drawn. Three beats and an arrow back to the start — which is the one thing a first-time
 * reader cannot get from a sentence: that this repeats, and that they are not committing to an
 * evening of it. Plain shapes and text so it stays legible at 400px and reads correctly to a
 * screen reader through the title, with the same content available as the cards beneath it.
 *
 * The return arrow is the only moving thing here, and it moves because the loop is the point.
 * `prefers-reduced-motion` holds it still as a plain dashed line (globals.css).
 */
function CycleDiagram({ minutes, pause }: { minutes: number; pause: number }) {
  const beats = [
    { x: 16, label: "Match found", sub: "One other person" },
    { x: 214, label: `${minutes} minutes`, sub: "On camera, together" },
    { x: 412, label: `${pause}-second pause`, sub: "Who is next, and you" },
  ];
  return (
    <div className="mt-5 overflow-x-auto">
      <svg viewBox="0 0 600 176" role="img" aria-labelledby="speed-networking-cycle-title" className="h-auto w-full min-w-[320px] max-w-[600px]">
        <title id="speed-networking-cycle-title">
          {`The speed networking cycle: a match is found, you talk for ${minutes} minutes on camera, there is a ${pause}-second pause showing who is next, and then it starts again with somebody new until you leave.`}
        </title>
        <defs>
          <marker id="wpl-net-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#73706a" />
          </marker>
        </defs>

        {beats.map((beat, index) => (
          <g key={beat.label}>
            <rect x={beat.x} y={16} width={172} height={72} rx={16} fill={index === 1 ? "#050505" : "#f5f3ef"} stroke={index === 1 ? "#050505" : "#e7e3dc"} strokeWidth={1} />
            <text x={beat.x + 86} y={48} textAnchor="middle" fontSize="16" fontWeight="800" fill={index === 1 ? "#ffffff" : "#050505"}>{beat.label}</text>
            <text x={beat.x + 86} y={70} textAnchor="middle" fontSize="13" fill={index === 1 ? "#f05a1a" : "#73706a"}>{beat.sub}</text>
            {index < beats.length - 1 ? (
              <line x1={beat.x + 176} y1={52} x2={beat.x + 208} y2={52} stroke="#73706a" strokeWidth="2" markerEnd="url(#wpl-net-arrow)" />
            ) : null}
          </g>
        ))}

        {/* and round again */}
        <path className="wpl-cycle-flow" d="M 498 92 L 498 126 L 102 126 L 102 94" fill="none" stroke="#f05a1a" strokeWidth="2" strokeDasharray="6 6" markerEnd="url(#wpl-net-arrow)" />
        <text x={300} y={150} textAnchor="middle" fontSize="13" fontWeight="800" fill="#73706a">and again with somebody new, until you leave</text>
      </svg>
    </div>
  );
}
