import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { HouseLogoUploader } from "@/components/settings/HouseLogoUploader";
import { clearHouseLogoAction, saveHouseDefaultsAction } from "@/lib/actions/houseDefaultsActions";
import { getHouseDefaults } from "@/services/agencies/houseDefaultsService";
import { questionLines } from "@/services/attendees/registrationQuestions";
import { livekitTier } from "@/lib/capacity/capacityPlans";
import { houseEmailDomain } from "@/types/houseDefaults";

/**
 * The house defaults: what a new event, a sent email and the capacity readout start from.
 *
 * Every field here is consumed somewhere, and the hint under it names where — a setting that saves
 * and changes nothing is worse than no setting. Nothing here is secret: access codes and the master
 * passwords stay in the owner-only audited vault in the Owner Console, and this page is reachable
 * by any operator.
 */
export async function HouseDefaultsPanel({ disabled }: { disabled?: boolean }) {
  const house = await getHouseDefaults();
  const envTier = livekitTier();
  const fromDomain = houseEmailDomain(house.fromEmail);
  return (
    <SectionCard title="House defaults" eyebrow="What a new event starts from">
      <div data-testid="house-defaults" data-tier={house.livekitTier || `env:${envTier}`}>
        <p className="text-sm text-brand-muted">
          Set these once and stop setting them on every event. Each one is read by the thing it governs; where an event can override, the event still wins.
        </p>

        <form action={saveHouseDefaultsAction} className="mt-5 space-y-6" data-testid="house-defaults-form">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-black">
              From address
              <input name="fromEmail" type="email" defaultValue={house.fromEmail} required className="mt-1 min-h-11 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="house-from-email" />
              <span className="mt-1 block text-xs font-normal text-brand-muted">
                What every email leaves from. Resend will only send from a domain you have verified with it — <strong>{fromDomain || "the domain you use here"}</strong> has to be verified in the Resend dashboard or the send fails at the provider, not here.
              </span>
            </label>
            <label className="text-sm font-black">
              Reply-to address
              <input name="replyToEmail" type="email" defaultValue={house.replyToEmail} required className="mt-1 min-h-11 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="house-reply-to" />
              <span className="mt-1 block text-xs font-normal text-brand-muted">Where a reply lands. Does not need a verified domain. Read by every send and printed on the Email page.</span>
            </label>
            <label className="text-sm font-black">
              Default timezone
              <input name="defaultTimezone" defaultValue={house.defaultTimezone} required placeholder="America/Chicago" className="mt-1 min-h-11 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="house-timezone" />
              <span className="mt-1 block text-xs font-normal text-brand-muted">An IANA name. New event opens on this instead of asking you every time.</span>
            </label>
            <label className="text-sm font-black">
              LiveKit tier
              <select name="livekitTier" defaultValue={house.livekitTier} className="mt-1 min-h-11 w-full rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="house-livekit-tier">
                <option value="">Follow the environment ({envTier})</option>
                <option value="build">Build</option>
                <option value="ship">Ship</option>
                <option value="scale">Scale</option>
              </select>
              <span className="mt-1 block text-xs font-normal text-brand-muted">What the capacity readout at <Link href="/app/capacity" className="font-black underline">/app/capacity</Link> measures you against. Change it here when you change plan; no redeploy.</span>
            </label>
            <label className="text-sm font-black">
              Networking match length
              <span className="mt-1 flex items-center gap-2">
                <input name="defaultNetworkingMatchMinutes" type="number" min={1} max={30} defaultValue={house.defaultNetworkingMatchMinutes} className="min-h-11 w-24 rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="house-networking-minutes" />
                <span className="text-xs font-normal text-brand-muted">minutes</span>
              </span>
              <span className="mt-1 block text-xs font-normal text-brand-muted">Written onto each new event&rsquo;s networking settings as it is created. Events that already exist keep what they were set to.</span>
            </label>
            <label className="text-sm font-black">
              Attendee stays registered for
              <span className="mt-1 flex items-center gap-2">
                <input name="defaultAttendeeSessionDays" type="number" min={1} max={365} defaultValue={house.defaultAttendeeSessionDays} className="min-h-11 w-24 rounded-2xl border border-brand-line px-4 text-sm font-normal" data-testid="house-session-days" />
                <span className="text-xs font-normal text-brand-muted">days</span>
              </span>
              <span className="mt-1 block text-xs font-normal text-brand-muted">Stamped on a new event; the per-event override on the event&rsquo;s own page still wins.</span>
            </label>
            <label className="text-sm font-black md:col-span-2">
              Default &ldquo;Tell us more&rdquo; questions
              <textarea name="defaultRegistrationQuestions" defaultValue={questionLines(house.defaultRegistrationQuestions)} rows={4} className="mt-1 w-full rounded-2xl border border-brand-line px-4 py-3 font-mono text-xs font-normal" data-testid="house-registration-questions" />
              <span className="mt-1 block text-xs font-normal text-brand-muted">One per line as <code>Label | textarea</code>, <code>Label | text</code> or <code>Label | tags</code>; up to eight. New event opens with these; the per-event editor still overrides.</span>
            </label>
          </div>

          <button type="submit" disabled={disabled} className="rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white hover:bg-brand-orange disabled:opacity-50" data-testid="house-defaults-save">Save house defaults</button>
        </form>

        <div className="mt-6 border-t border-brand-line pt-5">
          <p className="text-sm font-black">Logo</p>
          <p className="mt-1 text-xs text-brand-muted">
            Replaces the wordmark on the workspace, the new-event form, the request page and a client&rsquo;s proposal. Emails keep the wordmark: the logo lives in the private bucket behind a link that expires, and an expired image in a month-old email is worse than no image.
          </p>
          {house.logoStoragePath ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-xs text-brand-muted" data-testid="house-logo-current">In place: <strong>{house.logoFileName || "an uploaded file"}</strong>.</p>
              <form action={clearHouseLogoAction}>
                <button className="rounded-full border border-brand-line px-3 py-2 text-xs font-black text-brand-muted hover:border-brand-orange" data-testid="house-logo-clear" disabled={disabled}>Go back to the wordmark</button>
              </form>
            </div>
          ) : <p className="mt-3 text-xs text-brand-muted" data-testid="house-logo-current">No logo set, so the wordmark renders.</p>}
          <div className="mt-3"><HouseLogoUploader /></div>
        </div>
      </div>
    </SectionCard>
  );
}
