import { submitSpeakerCueDeckAction } from "@/lib/actions/guestActions";
import type { SpeakerCueDeckState, SpecialGuestProfile } from "@/types/specialGuest";

/**
 * The speaker pastes their own cue cards, talking points, or notes. Everything lands as the
 * PENDING version until the crew approves it. Paste only: this deployment has no file store wired
 * for runtime events, so .txt / .md / .pdf uploads are not offered (paste the text instead).
 */
export function SpeakerCuePastePanel({ eventId, speaker, deck, submitted }: { eventId: string; speaker?: SpecialGuestProfile; deck: SpeakerCueDeckState; submitted?: boolean }) {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="speaker-material-submission-panel">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Speaker materials</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Paste your own cue cards, talking points, or notes for the producer</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Nothing you paste goes live on its own: it lands as a pending version the producer approves with one click. Paste text only — file upload is not wired for this event, so paste the contents of your .txt / .md / .pdf instead.</p>
        {submitted ? <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="speaker-cue-submitted">Sent to the producer for approval.</p> : null}
        <form action={submitSpeakerCueDeckAction} className="mt-5 grid gap-3" data-testid="speaker-material-submission-form">
          <input type="hidden" name="eventId" value={eventId} />
          {!speaker ? <label className="grid gap-1 text-sm font-semibold text-slate-700">Name for the producer<input name="speakerName" className="rounded-xl border border-slate-300 px-3 py-2" placeholder="So the producer knows whose notes these are" /></label> : <input type="hidden" name="speakerName" value={speaker.name} />}
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Material type
            <select name="kind" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="teleprompter_note">Teleprompter note</option>
              <option value="deck">Deck link</option>
              <option value="supporting_document">Supporting document</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Title<input name="title" className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Updated keynote opener" /></label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Notes for producer<textarea name="notes" className="min-h-28 rounded-xl border border-slate-300 px-3 py-2" placeholder="Tell the producer what changed and whether it affects timing, slides, sponsor mentions, or legal/client approval." /></label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Cue cards (one per line: Title | body)<textarea name="cards" className="min-h-28 rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm" placeholder={"Open | Thank the host, 20 seconds\nStory | The night the servers went down"} data-testid="speaker-cards-input" /></label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Talking points (one per line)<textarea name="talkingPoints" className="min-h-20 rounded-xl border border-slate-300 px-3 py-2" placeholder={"Founder pain first\nInvite Q&A"} /></label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Script (optional)<textarea name="script" className="min-h-28 rounded-xl border border-slate-300 px-3 py-2" placeholder="Paste the full text if you read from one." /></label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Link to deck or document<input name="materialUrl" className="rounded-xl border border-slate-300 px-3 py-2" placeholder="https://drive.google.com/..." /></label>
          <button type="submit" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Queue for producer review</button>
        </form>
      </section>
      <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="speaker-material-review-queue">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Producer review queue</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Your pending version</h2>
        {deck.pending ? (
          <div className="mt-4 rounded-2xl border border-slate-200 p-4" data-testid="speaker-pending-version">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-950">Version {deck.pending.versionNumber} · {deck.pending.cards.length} card{deck.pending.cards.length === 1 ? "" : "s"}{deck.pending.cards[0] ? ` · ${deck.pending.cards[0].title}` : ""}</p>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">Queued for producer review</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">{deck.pending.cards.map((card) => <li key={card.id}><strong>{card.title}</strong>{card.body ? ` — ${card.body}` : ""}</li>)}</ul>
          </div>
        ) : <p className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">Nothing is waiting for review. {deck.approved ? `Version ${deck.approved.versionNumber} is live on your teleprompter.` : "No version has been approved yet."}</p>}
      </section>
    </div>
  );
}
