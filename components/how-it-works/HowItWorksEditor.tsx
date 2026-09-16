import { saveHowItWorksPageAction } from "@/lib/actions/howItWorksActions";
import type { HowItWorksView } from "@/services/content/howItWorksService";

/**
 * The editor, shown only to owner and operator.
 *
 * Hiding it from everyone else is a courtesy; the rule is enforced in the action, which checks the
 * gate again on the server. A visitor who posts the form by hand is refused there.
 */
export function HowItWorksEditor({ page, saved, error }: { page: HowItWorksView; saved?: boolean; error?: string }) {
  return (
    <details className="mt-10 rounded-3xl border border-brand-line bg-brand-ash p-5" data-testid="how-it-works-editor">
      <summary className="cursor-pointer text-sm font-black">Edit this page</summary>
      <p className="mt-2 text-xs text-brand-muted">
        Everyone who was ever sent the link reads this page, including people mailed months ago. A fix here reaches all of them. Headings are <code>## like this</code>, bullets start with <code>-</code>.
      </p>
      {saved ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="how-it-works-saved">Saved. Anyone opening the link now sees this.</p> : null}
      {error ? <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-900" data-testid="how-it-works-error">{error}</p> : null}
      <form action={saveHowItWorksPageAction} className="mt-4 grid gap-3">
        <input type="hidden" name="slug" value={page.slug} />
        <label className="text-xs font-black uppercase tracking-[0.2em] text-brand-muted" htmlFor={`title-${page.slug}`}>Title</label>
        <input id={`title-${page.slug}`} name="title" defaultValue={page.title} className="min-h-11 rounded-2xl border border-brand-line px-4 text-sm" data-testid="how-it-works-title" />
        <label className="text-xs font-black uppercase tracking-[0.2em] text-brand-muted" htmlFor={`intro-${page.slug}`}>Intro</label>
        <textarea id={`intro-${page.slug}`} name="intro" defaultValue={page.intro} rows={3} className="rounded-2xl border border-brand-line px-4 py-3 text-sm" data-testid="how-it-works-intro" />
        <label className="text-xs font-black uppercase tracking-[0.2em] text-brand-muted" htmlFor={`body-${page.slug}`}>Body</label>
        <textarea id={`body-${page.slug}`} name="body" defaultValue={page.body} rows={24} className="rounded-2xl border border-brand-line px-4 py-3 font-mono text-xs" data-testid="how-it-works-body" />
        <button className="justify-self-start rounded-full bg-brand-black px-5 py-2 text-sm font-black text-white" data-testid="how-it-works-save">Save the page</button>
      </form>
    </details>
  );
}
