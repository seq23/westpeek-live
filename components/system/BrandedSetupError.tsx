import { WestPeekProductionsLogoHomeLink } from "@/components/brand/WestPeekProductionsLogo";

export function BrandedSetupError({
  title,
  message,
  missingVariables = [],
  defaultValues = [],
  returnHref = "/production-access",
}: {
  title: string;
  message: string;
  missingVariables?: string[];
  defaultValues?: string[];
  returnHref?: string;
}) {
  return (
    <main className="min-h-screen bg-brand-ash px-5 py-10 text-brand-black sm:px-8 lg:px-12">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
        <WestPeekProductionsLogoHomeLink size="md" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Internal setup required</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-brand-muted">{message}</p>
        {missingVariables.length ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-black text-amber-950">Missing variable{missingVariables.length > 1 ? "s" : ""}</p>
            <ul className="mt-3 space-y-2 text-sm font-mono text-amber-900">
              {missingVariables.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        {defaultValues.length ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-black text-slate-950">Day 1 internal defaults</p>
            <ul className="mt-3 space-y-2 text-sm font-mono text-slate-700">
              {defaultValues.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        <p className="mt-5 text-sm leading-6 text-brand-muted">Set missing values in local <span className="font-mono">.env.local</span> for development and in Cloudflare Worker environment variables before deployment. This setup screen is intentional; generic server exception pages are forbidden on front-door routes.</p>
        <a href={returnHref} className="mt-6 inline-flex rounded-full bg-brand-black px-6 py-3 text-sm font-bold text-white">Back to production access</a>
      </section>
    </main>
  );
}
