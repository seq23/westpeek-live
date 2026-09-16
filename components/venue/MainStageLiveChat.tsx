import type { VirtualVenueModel } from "@/types/virtualVenue";
import { LiveRoomChat } from "@/components/venue/LiveRoomChat";
import { SafeSection } from "@/components/system/SafeSection";

export function MainStageLiveChat({ model }: { model: VirtualVenueModel }) {
  return <SafeSection label="Live chat" render={() => LiveRoomChat({ eventId: model.eventId, roomKind: "main_stage", roomId: "main-stage", title: "Everyone can talk here", description: `Conference-wide main stage chat for attendees watching ${model.eventName}.` })} />;
}
