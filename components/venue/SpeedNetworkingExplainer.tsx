import { SPEED_NETWORKING_CYCLE, SPEED_NETWORKING_DEFAULT_MINUTES } from "@/types/speedNetworking";
import { SPEED_NETWORKING_ROOM_CAPACITY } from "@/services/speed-networking/speedNetworkingRoomGuard";
import { SPEED_NETWORKING_MATCHING_CONFIG } from "@/services/speed-networking/speedNetworkingTiers";

/**
 * What speed networking actually is, before anyone presses the button.
 *
 * The page used to say "Meet other attendees, one at a time." and offer a Join queue button, which
 * assumes the reader has done this before. Somebody who has not is being asked to agree to
 * something they cannot picture — and the honest description ("four minutes on camera with one
 * person you have not met, then it moves you on") is the difference between hesitating and
 * pressing it (the owner, 17 Sep 2026).
 *
 * Every number here is read from the code that enforces it rather than typed into the copy:
 * the round length from the event's own setting (SPEED_NETWORKING_DEFAULT_MINUTES when it has not
 * been changed), the pause from SPEED_NETWORKING_CYCLE.setupGapSeconds, the room size from the
 * guard's own capacity constant, and the matching claims from SPEED_NETWORKING_MATCHING_CONFIG —
 * which has its own fairness-contract validator. If somebody retunes the cycle, this page changes
 * with it instead of quietly becoming a false promise.
 *
 * NO PHOTOGRAPHS OF PEOPLE, ever. A stock photograph on this page is a stranger presented as an
 * attendee of this event. The diagram is drawn in SVG, carries no likeness, needs no asset, and
 * explains the loop better than a picture of a smiling person in a headset.
 */

const SHARED = SPEED_NETWORKING_MATCHING_CONFIG;

export function SpeedNetworkingExplainer({ matchMinutes = SPEED_NETWORKING_DEFAULT_MINUTES }: { matchMinutes?: number }) {
  const minutes = Number.isFinite(matchMinutes) && matchMinutes > 0 ? Math.round(matchMinutes) : SPEED_NETWORKING_DEFAULT_MINUTES;
  const pause = SPEED_NETWORKING_CYCLE.setupGapSeconds;

  const facts: Array<{ title: string; body: string }> = [
    {
      title: `${minutes} minutes, one other person`,
      body: `A video call with exactly one other person, cameras and microphones on, with a timer counting down. The room holds ${SPEED_NETWORKING_ROOM_CAPACITY === 2 ? "two people and only two" : `${SPEED_NETWORKING_ROOM_CAPACITY} people`} — nobody can walk in on it.`,
    },
    {
      title: "Someone you have not met",
      body: `You are never paired with the same person twice${SHARED.blockSameCompany ? ", and never with someone from your own organisation" : ""}. When few people are waiting it is simply whoever has waited longest; when the room is busy it looks at the topics you both care about and at who wants opposite sides of the same conversation — someone hiring and someone looking, say — with waiting time weighted heavily enough that nobody is left out in favour of a better pairing.`,
    },
    {
      title: `A ${pause}-second pause between calls`,
      body: "When a call ends you are not dropped straight into the next one. There is a short beat that shows who you are about to meet and gives you your own camera preview back, so you arrive ready rather than mid-sentence.",
    },
    {
      title: "It keeps going until you leave",
      body: "One call ends, the next is found, and round follows round for as long as you stay. Leaving is one button and takes effect immediately; nothing is scheduled and you do not have to sign up for a slot.",
    },
  ];

  return (
    <section className="rounded-3xl bg-white p-5 sm:p-6" data-testid="speed-networking-explainer" data-match-minutes={minutes} data-setup-gap-seconds={pause}>
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Speed networking</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-3xl">
        {minutes} minutes on camera with one person you have not met. Then it moves you on.
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        You join a queue, not a meeting. When a match is found you are put straight into a video call with one other
        person. When the timer runs out you both go back in, and it happens again with somebody new — for as long as
        you want it to.
      </p>

      <CycleDiagram minutes={minutes} pause={pause} />

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-sm font-black text-slate-950">{fact.title}</dt>
            <dd className="mt-1 text-sm leading-6 text-slate-600">{fact.body}</dd>
          </div>
        ))}
      </dl>

      {/* The privacy promise. It is the sentence people actually want answered, and it is already
          well written — it moves, it does not change. */}
      <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-black text-slate-900" data-testid="speed-networking-privacy-promise">
        Your match sees your name and your company. Nothing else.
      </p>
    </section>
  );
}

/**
 * The loop, drawn. Three beats and an arrow back to the start — which is the one thing a first-time
 * reader cannot get from a sentence: that this repeats, and that they are not committing to an
 * evening of it. Plain shapes and text so it stays legible at 400px and reads correctly to a
 * screen reader through the title, with the same content available as the list beneath it.
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
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        {beats.map((beat, index) => (
          <g key={beat.label}>
            <rect x={beat.x} y={16} width={172} height={72} rx={16} fill={index === 1 ? "#fff1e7" : "#f8fafc"} stroke={index === 1 ? "#f97316" : "#e2e8f0"} strokeWidth={index === 1 ? 2 : 1} />
            <text x={beat.x + 86} y={48} textAnchor="middle" fontSize="16" fontWeight="800" fill="#020617">{beat.label}</text>
            <text x={beat.x + 86} y={70} textAnchor="middle" fontSize="13" fill="#475569">{beat.sub}</text>
            {index < beats.length - 1 ? (
              <line x1={beat.x + 176} y1={52} x2={beat.x + 208} y2={52} stroke="#94a3b8" strokeWidth="2" markerEnd="url(#wpl-net-arrow)" />
            ) : null}
          </g>
        ))}

        {/* and round again */}
        <path d="M 498 92 L 498 126 L 102 126 L 102 94" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5" markerEnd="url(#wpl-net-arrow)" />
        <text x={300} y={150} textAnchor="middle" fontSize="13" fontWeight="800" fill="#475569">…and again with somebody new, until you leave</text>
      </svg>
    </div>
  );
}
