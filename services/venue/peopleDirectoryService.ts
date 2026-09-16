import type { VirtualVenuePerson } from "@/types/virtualVenue";
import { excludePreviewIdentities } from "@/lib/auth/previewIdentity";

export function searchPeople(people: VirtualVenuePerson[], query: string) {
  const normalized = query.trim().toLowerCase();
  const visible = excludePreviewIdentities(people, (person) => person.id);
  if (!normalized) return visible;

  return visible.filter((person) =>
    [person.displayName, person.company, person.title]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized)),
  );
}

export function filterNetworkingOptIn(people: VirtualVenuePerson[]) {
  return excludePreviewIdentities(people, (person) => person.id).filter((person) => person.networkingOptIn);
}
