import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { randomId } from "@/lib/security/portableCrypto";
import type { V4AnalyticsEvent } from "@/types/v4";

export function buildAnalyticsEvent(input: Omit<V4AnalyticsEvent, "id" | "createdAt">): V4AnalyticsEvent {
  return {
    id: randomId("analytics"),
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export async function recordAnalyticsEvent(input: Omit<V4AnalyticsEvent, "id" | "createdAt">): Promise<V4AnalyticsEvent> {
  const event = buildAnalyticsEvent(input);
  try {
    return await getRuntimeStore().appendAnalyticsEvent(event);
  } catch {
    return event;
  }
}
