import { GuestRoomVideo } from "@/components/video/GuestRoomVideo";
import { goOnStageAction } from "@/lib/actions/guestActions";
import { getEvent, getRunOfShowForEvent } from "@/lib/runtime/getRuntimeData";
import { formatEventDate } from "@/lib/utils/format";
import { getProducerNotes, getSpeakerCueDeck, getSpeakerLiveCue, getSpeakerStageState, getSpeakerTechCheck } from "@/services/guests/guestStateService";
import { GREEN_ROOM_ID, type SpecialGuestProfile } from "@/types/specialGuest";
import { SpeakerTeleprompterLive } from "./SpeakerTeleprompterLive";

/**
 * The green room is a real place: THIS event's run of show with the speaker's slot, the producer's
 * notes to speakers, the recorded tech check, the approved cue cards, the backstage LiveKit room
 * (<eventId>-green-room, speakers + crew only), and "Go on stage" once the crew brings them up.
 */
export async function SpeakerGreenRoomLive({ eventId, speaker, error }: { eventId: string; speaker: SpecialGuestProfile; error?: string }) {
  const [stage, techCheck, notes, deck, liveCue] = await Promise.all([
    getSpeakerStageState(eventId, speaker.guestId),
    getSpeakerTechCheck(eventId, speaker.guestId),
    getProducerNotes(eventId),
    getSpeakerCueDeck(eventId, speaker.guestId),
    getSpeakerLiveCue(eventId, speaker.guestId),
  ]);
  const event = getEvent(eventId);
  const segments = getRunOfShowForEvent(eventId);
  const needle = speaker.name.toLowerCase();
  const mine = segments.filter((segment) => segment.speakerId === speaker.guestId || (needle && (segment.segmentTitle.toLowerCase().includes(needle) || segment.publicTitle.toLowerCase().includes(needle))));
  return (
    <div className="space-y-6" data-testid="speaker-green-room" data-stage-status={stage.status}>
      {error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{error}</p> : null}

      <section className={`rounded-3xl border p-6 shadow-sm ${stage.status === "backstage" ? "border-slate-200 bg-white" : "border-emerald-300 bg-emerald-50"}`} data-testid="speaker-stage-call">
        {stage.status === "backstage" ? (
          <>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">Backstage</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Wait here. The crew brings you to the stage when it is your moment.</h2>
            <p className="mt-2 text-sm text-slate-600">This page updates when they do. Use the time for the tech check and your cue cards.</p>
          </>
        ) : (
          <>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-800">{stage.status === "on_stage" ? "You are on stage" : "The crew is bringing you to the stage"}</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{stage.status === "on_stage" ? "Your camera and microphone are live on the main stage." : "Go on stage now: your camera and microphone will publish to the main stage."}</h2>
            <form action={goOnStageAction} className="mt-4"><input type="hidden" name="eventId" value={eventId} /><button className="rounded-full bg-emerald-700 px-6 py-3 text-base font-black text-white hover:bg-emerald-800" data-testid="go-on-stage">{stage.status === "on_stage" ? "Open the stage" : "Go on stage"}</button></form>
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <GuestRoomVideo eventId={eventId} roomId={GREEN_ROOM_ID} roomType="green_room" role="speaker" displayName={speaker.name} title="Backstage room · crew and speakers see and hear each other here" />
        <div className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="producer-notes-to-speakers">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Producer notes to speakers</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{notes?.text || "The producer has not left notes yet."}</p>
            {notes?.text ? <p className="mt-2 text-xs text-slate-400">Updated {new Date(notes.updatedAt).toLocaleString()} by {notes.updatedBy}</p> : null}
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="speaker-tech-check-summary" data-status={techCheck?.status || "none"}>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Tech check</p>
            <p className="mt-2 text-sm text-slate-700">{techCheck ? `${techCheck.status.replaceAll("_", " ")} · ${techCheck.score}/100 · recorded ${new Date(techCheck.recordedAt).toLocaleString()}` : "Not recorded yet."}</p>
            <a href={`/speaker/events/${eventId}/tech-check`} className="mt-3 inline-block rounded-full border border-slate-300 px-4 py-2 text-xs font-black">{techCheck ? "Run it again" : "Run the tech check"}</a>
          </section>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="speaker-run-of-show">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Run of show · your slot</p>
        {segments.length ? (
          <ol className="mt-3 space-y-2">
            {segments.map((segment) => {
              const isMine = mine.some((item) => item.id === segment.id);
              return <li key={segment.id} className={`rounded-2xl p-3 text-sm ${isMine ? "border border-brand-orange bg-brand-orangeSoft" : "bg-slate-50"}`} data-testid={isMine ? "speaker-slot" : undefined}><span className="font-black">{formatEventDate(segment.startAt, event.timezone)}</span> · {segment.publicTitle} · {segment.room}{isMine ? <span className="ml-2 rounded-full bg-brand-orange px-2 py-0.5 text-[11px] font-black uppercase text-white">You</span> : null}</li>;
            })}
          </ol>
        ) : <p className="mt-3 text-sm text-slate-600">No run of show yet for this event. The producer builds it on the command page.</p>}
        {segments.length && !mine.length ? <p className="mt-3 text-xs text-slate-500">No segment names you yet; the producer assigns your slot.</p> : null}
      </section>

      <SpeakerTeleprompterLive eventId={eventId} initial={{ approved: deck.approved || null, pendingVersionNumber: deck.pending?.versionNumber || null, liveCue: liveCue?.text ? liveCue : null, stage }} fullScreenHref={`/speaker/events/${eventId}/teleprompter`} />
    </div>
  );
}
