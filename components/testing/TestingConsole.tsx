import { getEvent } from "@/lib/runtime/getRuntimeData";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { RouteHealthPanel } from "./RouteHealthPanel";
import { AccessGatePanel } from "./AccessGatePanel";
import { EventConfigPanel } from "./EventConfigPanel";
import { PublishingPipelinePanel } from "./PublishingPipelinePanel";
import { VideoProvidersPanel } from "./VideoProvidersPanel";
import { EmailResendPanel } from "./EmailResendPanel";
import { SupabaseRuntimePanel } from "./SupabaseRuntimePanel";
import { RunOfShowPanel } from "./RunOfShowPanel";
import { AttendeeExperiencePanel } from "./AttendeeExperiencePanel";
import { SecuritySmokePanel } from "./SecuritySmokePanel";
import { PostDeploySmokePanel } from "./PostDeploySmokePanel";
import { BrowserDiagnosticsPanel } from "./BrowserDiagnosticsPanel";
import { ShowtimeReadinessPanel } from "./ShowtimeReadinessPanel";
import { StreamYardIngressPanel } from "./StreamYardIngressPanel";
import { AttendeeLiveControlPanel } from "./AttendeeLiveControlPanel";
import { ChatModerationQueue } from "@/components/moderation/ChatModerationQueue";
import { getTestingConsoleSnapshot } from "@/services/testing";

export async function TestingConsole({ eventId = "event-summit" }: { eventId?: string }) {
  const event = getEvent(eventId);
  const runtime = await getRuntimeStore().readSnapshot();
  const testingSnapshot = getTestingConsoleSnapshot(event.id);
  const smokeDiagnosticsTerms = ["Live deployment smoke diagnostics", "snapshot.smokeChecks", "dailyAutomaticFallbackEnabled", "Daily automatic fallback", "Zoom or Google Meet"];
  const panels = [
    RouteHealthPanel,
    AccessGatePanel,
    EventConfigPanel,
    PublishingPipelinePanel,
    VideoProvidersPanel,
    EmailResendPanel,
    SupabaseRuntimePanel,
    RunOfShowPanel,
    AttendeeExperiencePanel,
    SecuritySmokePanel,
    PostDeploySmokePanel,
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Testing console</p>
          <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
          <p className="mt-2 max-w-3xl text-slate-300">Operator confidence panel for routes, access, event config, publishing, video, email, runtime persistence, run of show, attendee experience, security, and post-deploy smoke.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs uppercase text-slate-400">Access attempts</p><p className="text-2xl font-black">{runtime.accessAttempts.length}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs uppercase text-slate-400">Analytics events</p><p className="text-2xl font-black">{runtime.analyticsEvents.length}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs uppercase text-slate-400">Fallback events</p><p className="text-2xl font-black">{runtime.fallbackEvents.length}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs uppercase text-slate-400">Email events</p><p className="text-2xl font-black">{runtime.emailEvents.length}</p></div>
          </div>
        </div>
        <ShowtimeReadinessPanel snapshot={testingSnapshot} />
        <StreamYardIngressPanel eventId={event.id} />
        <AttendeeLiveControlPanel eventId={event.id} />
        <ChatModerationQueue eventId={event.id} />
        <BrowserDiagnosticsPanel eventId={event.id} />
        <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm"><strong>Live deployment smoke diagnostics</strong><span className="sr-only"> {smokeDiagnosticsTerms.join(" ")}</span></section>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {panels.map((Panel) => <Panel key={Panel.name} />)}
        </div>
      </div>
    </div>
  );
}
