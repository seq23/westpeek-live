import type { VirtualVenueBooth } from "@/types/virtualVenue";

export function findBooth(booths: VirtualVenueBooth[], boothId: string) {
  return booths.find((booth) => booth.id === boothId) ?? booths[0];
}
