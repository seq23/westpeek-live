import { LiveKitVideoSurface } from "./LiveKitVideoSurface";
import { SpeedNetworkingReportPanel } from "./SpeedNetworkingReportPanel";
import { SpeedNetworkingTimer } from "./SpeedNetworkingTimer";

export function SpeedNetworkingMatchRoom({ label = "Networking match" }: { label?: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <section className="rounded-3xl bg-white p-5">
        <LiveKitVideoSurface label={label} />
        <div className="mt-4"><SpeedNetworkingTimer secondsRemaining={180} /></div>
      </section>
      <SpeedNetworkingReportPanel />
    </div>
  );
}
