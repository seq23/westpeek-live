import type { VirtualVenuePerson } from "@/types/virtualVenue";

export function PeopleDirectoryCard({ person }: { person: VirtualVenuePerson }) {
  return (
    <details className="group rounded-3xl border border-slate-200 bg-white p-5 open:border-brand-orange">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{person.displayName}</h3>
            <p className="mt-1 text-sm text-slate-600">{[person.title, person.company].filter(Boolean).join(" · ") || "Attendee"}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Profile</span>
        </div>
        {person.networkingOptIn ? <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Open to networking</p> : null}
      </summary>
      <div className="mt-5 space-y-4 border-t border-slate-100 pt-4 text-sm text-slate-700">
        {/* Only what the person wrote; no placeholder sentences (owner, 16 Sep 2026). */}
        {person.reasonForAttending ? <div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">What brings me here</p><p className="mt-1" data-testid="person-reason">{person.reasonForAttending}</p></div> : null}
        {person.interestingFact ? <div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Interesting fact</p><p className="mt-1" data-testid="person-fact">{person.interestingFact}</p></div> : null}
        {!person.reasonForAttending && !person.interestingFact && !person.personalWebsite && !person.socialLinks?.length ? <p className="text-slate-500">{person.displayName} has not added more yet.</p> : null}
        {person.personalWebsite || person.socialLinks?.length ? (
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Links</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {person.personalWebsite ? <a href={person.personalWebsite} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold hover:border-brand-orange">Website</a> : null}
              {(person.socialLinks || []).map((link) => <a key={link} href={link} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold hover:border-brand-orange">Social</a>)}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
