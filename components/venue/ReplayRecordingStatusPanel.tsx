import type { LiveKitEgressJob } from "@/types/livekitEgress";

export function ReplayRecordingStatusPanel({ jobs }: { jobs: LiveKitEgressJob[] }) {
  return (
    <section className="rounded-3xl bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Recording</p>
      <h2 className="mt-2 text-2xl font-semibold">LiveKit egress jobs</h2>
      <div className="mt-4 space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold">{job.status}</p>
            <p className="text-sm text-slate-600">{job.storageBucket}/{job.storagePath}</p>
            {job.failureReason ? <p className="mt-1 text-sm text-red-700">{job.failureReason}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
