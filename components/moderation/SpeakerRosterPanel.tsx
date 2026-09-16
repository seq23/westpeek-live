import { approveSpeakerCueDeckAction, bringSpeakerToStageAction, pushLiveCueAction, saveProducerCueDeckAction, saveProducerNotesAction, sendSpeakerBackstageAction, setVipRoomAction } from "@/lib/actions/speakerStageActions";
import { listGuestProfiles } from "@/services/guests/guestIdentityService";
import { getProducerNotes, getVipRoom, listSpeakerCueDecks, listSpeakerStageStates, listSpeakerTechChecks } from "@/services/guests/guestStateService";
import type { CueDeckVersion } from "@/types/specialGuest";

function deckToLines(version?: CueDeckVersion) {
  return { cards: (version?.cards || []).map((card) => (card.body ? `${card.title} | ${card.body}` : card.title)).join("\n"), talkingPoints: (version?.talkingPoints || []).join("\n"), script: version?.script || "" };
}

function when(value?: string) {
  return value ? new Date(value).toLocaleTimeString() : "—";
}

/**
 * Speakers, above the attendees, on every crew surface: who they are, their recorded tech check,
 * whether they are backstage / invited / on stage, and their cue deck. Bring to stage / Send
 * backstage per row; the cue-card editor, pending approval, and live cue fold out per speaker.
 * Also the producer's notes to speakers and the VIP room switch. Every button is a guarded action.
 */
export async function SpeakerRosterPanel({ eventId }: { eventId: string }) {
  const [speakers, stages, techChecks, decks, notes, vipRoom, vips] = await Promise.all([
    listGuestProfiles(eventId, "speaker").catch(() => []),
    listSpeakerStageStates(eventId),
    listSpeakerTechChecks(eventId),
    listSpeakerCueDecks(eventId),
    getProducerNotes(eventId),
    getVipRoom(eventId),
    listGuestProfiles(eventId, "vip").catch(() => []),
  ]);
  const stageOf = new Map(stages.map((item) => [item.guestId, item.state]));
  const techOf = new Map(techChecks.map((item) => [item.guestId, item.state]));
  const deckOf = new Map(decks.map((item) => [item.guestId, item.state]));
  const onStage = speakers.filter((speaker) => stageOf.get(speaker.guestId)?.status === "on_stage").length;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="speaker-roster">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Speakers</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">{speakers.length} speaker{speakers.length === 1 ? "" : "s"} · {onStage} on stage</h2>
      <p className="mt-2 text-sm text-slate-600">Speakers enter with the speaker code and give their name once. Bring to stage grants camera + mic on the main stage and shows them &ldquo;Go on stage&rdquo;; Send backstage revokes it and drops them from the stage room. Cue cards you save here are live on their teleprompter within ~5s.</p>

      <div className="mt-4 space-y-3" data-testid="speaker-rows">
        {speakers.length ? speakers.map((speaker) => {
          const stage = stageOf.get(speaker.guestId);
          const tech = techOf.get(speaker.guestId);
          const deck = deckOf.get(speaker.guestId);
          const status = stage?.status || "backstage";
          const lines = deckToLines(deck?.approved);
          return (
            <article key={speaker.guestId} className={`rounded-2xl border p-4 ${status === "on_stage" ? "border-emerald-300 bg-emerald-50" : status === "invited" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`} data-testid={`speaker-row-${speaker.guestId}`} data-stage-status={status} data-tech-status={tech?.status || "none"}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{speaker.name} <span className="font-medium text-slate-500">· {speaker.company || "no company"}{speaker.title ? ` · ${speaker.title}` : ""}</span></p>
                  <p className="mt-1 text-xs text-slate-600">Tech check: <strong data-testid={`speaker-tech-${speaker.guestId}`}>{tech ? `${tech.status.replaceAll("_", " ")} · ${tech.score}/100` : "not recorded"}</strong> · Cue cards: <strong>{deck?.approved ? `v${deck.approved.versionNumber} live` : "none"}{deck?.pending ? ` · v${deck.pending.versionNumber} pending` : ""}</strong> · <code className="text-[11px] text-slate-400">{speaker.guestId}</code></p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-700" data-testid={`speaker-stage-${speaker.guestId}`}>{status.replaceAll("_", " ")}{status !== "backstage" && stage ? ` · by ${stage.updatedBy}` : ""}</span>
                  {status === "backstage" ? (
                    <form action={bringSpeakerToStageAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="speakerId" value={speaker.guestId} /><button className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white" data-testid={`bring-to-stage-${speaker.guestId}`}>Bring to stage</button></form>
                  ) : (
                    <form action={sendSpeakerBackstageAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="speakerId" value={speaker.guestId} /><button className="rounded-full border border-rose-300 px-4 py-2 text-xs font-black text-rose-800" data-testid={`send-backstage-${speaker.guestId}`}>Send backstage</button></form>
                  )}
                </div>
              </div>

              <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-3" data-testid={`speaker-cue-editor-${speaker.guestId}`}>
                <summary className="cursor-pointer text-sm font-black text-slate-950">Cue cards, talking points, script, live cue</summary>
                {deck?.pending ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3" data-testid={`speaker-pending-${speaker.guestId}`}>
                    <p className="text-xs font-black uppercase tracking-wide text-amber-800">Pending from {deck.pending.authorLabel} · v{deck.pending.versionNumber}</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700">{deck.pending.cards.map((card) => <li key={card.id}><strong>{card.title}</strong>{card.body ? ` — ${card.body}` : ""}</li>)}{deck.pending.talkingPoints.map((point, position) => <li key={`tp-${position}`}>• {point}</li>)}</ul>
                    {deck.pending.script ? <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{deck.pending.script}</p> : null}
                    <div className="mt-3 flex gap-2">
                      <form action={approveSpeakerCueDeckAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="speakerId" value={speaker.guestId} /><input type="hidden" name="decision" value="approve" /><button className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white" data-testid={`approve-cue-deck-${speaker.guestId}`}>Approve · make it live</button></form>
                      <form action={approveSpeakerCueDeckAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="speakerId" value={speaker.guestId} /><input type="hidden" name="decision" value="discard" /><button className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-700">Discard</button></form>
                    </div>
                  </div>
                ) : null}
                <form action={saveProducerCueDeckAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="speakerId" value={speaker.guestId} />
                  <label className="grid gap-1 text-xs font-bold text-slate-700">Cue cards · one per line · Title | body<textarea name="cards" defaultValue={lines.cards} className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm" placeholder={"Open | Thank the host, 20 seconds\nStory | The night the servers went down\nClose | Invite Q&A"} data-testid={`cue-cards-input-${speaker.guestId}`} /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-700">Talking points · one per line<textarea name="talkingPoints" defaultValue={lines.talkingPoints} className="min-h-16 rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-700">Script (optional)<textarea name="script" defaultValue={lines.script} className="min-h-16 rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
                  <div><button className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white" data-testid={`save-cue-deck-${speaker.guestId}`}>Save as live version</button>{deck?.approved ? <span className="ml-3 text-xs text-slate-500">Currently v{deck.approved.versionNumber} · {deck.approved.cards.length} cards · approved {when(deck.approved.approvedAt)}</span> : null}</div>
                </form>
                <form action={pushLiveCueAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="speakerId" value={speaker.guestId} />
                  <input name="cue" placeholder="Live cue: wrap in 2 min · next question" className="min-h-10 flex-1 rounded-full border border-slate-300 px-4 text-sm" data-testid={`live-cue-input-${speaker.guestId}`} />
                  <button className="rounded-full bg-brand-orange px-4 py-2 text-xs font-black text-white" data-testid={`push-live-cue-${speaker.guestId}`}>Push cue</button>
                  <span className="text-xs text-slate-500">Empty + Push clears it.</span>
                </form>
              </details>
            </article>
          );
        }) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No speakers yet. Rows appear when someone enters with the speaker code and gives their name.</p>}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form action={saveProducerNotesAction} className="rounded-2xl bg-slate-50 p-4" data-testid="producer-notes-form">
          <input type="hidden" name="eventId" value={eventId} />
          <p className="text-sm font-black text-slate-950">Producer notes to speakers</p>
          <p className="text-xs text-slate-600">Shown in every speaker&rsquo;s green room.</p>
          <textarea name="notes" defaultValue={notes?.text || ""} className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Join the green room 15 minutes before your slot. Keep the sponsor mention before Q&A." />
          <button className="mt-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-black">Save notes</button>
        </form>
        <div className="rounded-2xl bg-slate-50 p-4" data-testid="vip-room-control" data-open={vipRoom.open ? "true" : "false"}>
          <p className="text-sm font-black text-slate-950">VIP lounge</p>
          <p className="text-xs text-slate-600">{vipRoom.open ? `Open · VIPs see it in the lobby · by ${vipRoom.updatedBy}` : "Closed · VIPs see only their badge"} · {vips.length} VIP{vips.length === 1 ? "" : "s"} named</p>
          <form action={setVipRoomAction} className="mt-2"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="open" value={vipRoom.open ? "false" : "true"} /><button className={`rounded-full px-4 py-2 text-xs font-black ${vipRoom.open ? "border border-rose-300 text-rose-800" : "bg-slate-950 text-white"}`} data-testid="vip-room-toggle">{vipRoom.open ? "Close the VIP lounge" : "Open the VIP lounge"}</button></form>
        </div>
      </div>
    </section>
  );
}
