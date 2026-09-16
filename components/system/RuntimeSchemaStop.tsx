import type { RuntimeSchemaStatus } from "@/services/events/eventRepository";

/**
 * A named stop, shown exactly where the owner would otherwise hit a silent
 * failure: the runtime tables have not been created in Supabase yet.
 */
export function RuntimeSchemaStop({ status }: { status: RuntimeSchemaStatus }) {
  if (status.ok) return null;
  return (
    <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-900" role="alert" data-testid="runtime-schema-stop">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-red-700">Named stop · database not initialised</p>
      <h2 className="mt-2 text-xl font-black">Events cannot be saved until one migration runs.</h2>
      {status.missingTables.length ? (
        <p className="mt-2">Missing in the {status.store} store: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">{status.missingTables.join(", ")}</code>.</p>
      ) : null}
      {status.detail ? <p className="mt-2">Store error: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">{status.detail}</code></p> : null}
      <ol className="mt-3 list-decimal space-y-1 pl-5">
        <li>Open the Supabase project for westpeek.live → SQL editor.</li>
        <li>Paste and run <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">{status.migrationFile}</code> from this repository (additive, idempotent, no RLS changes).</li>
        <li>Reload this page. The form unlocks as soon as the tables exist; nothing else needs a redeploy.</li>
      </ol>
    </section>
  );
}
