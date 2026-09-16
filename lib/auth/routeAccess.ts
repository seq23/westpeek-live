import { CAPABILITIES } from "@/lib/permissions/capabilities";

export interface RouteAccessRequirement {
  prefix: string;
  label: string;
  capability: string;
}

export const protectedRouteRequirements: RouteAccessRequirement[] = [
  { prefix: "/app", label: "Agency app", capability: CAPABILITIES.AGENCY_VIEW_DASHBOARD },
  { prefix: "/admin", label: "Testing console", capability: CAPABILITIES.AGENCY_VIEW_DASHBOARD },
  // The manual: owner and operator read it inside the app; it carries no codes by design.
  { prefix: "/manual", label: "Operator manual", capability: CAPABILITIES.AGENCY_VIEW_DASHBOARD },
  { prefix: "/billing", label: "Billing", capability: CAPABILITIES.AGENCY_VIEW_DASHBOARD },
  { prefix: "/client", label: "Client portal", capability: CAPABILITIES.CLIENT_VIEW_PORTAL },
  { prefix: "/crew", label: "Crew portal", capability: CAPABILITIES.CONTRACTOR_VIEW_OWN_ASSIGNMENTS },
  { prefix: "/speaker", label: "Speaker portal", capability: CAPABILITIES.SPEAKER_VIEW_OWN_PORTAL },
  { prefix: "/sponsor", label: "Sponsor portal", capability: CAPABILITIES.SPONSOR_VIEW_OWN_BOOTH },
];

export function getRouteRequirement(pathname: string): RouteAccessRequirement | null {
  return protectedRouteRequirements.find((requirement) => pathname === requirement.prefix || pathname.startsWith(`${requirement.prefix}/`)) ?? null;
}

export function isProtectedPath(pathname: string) {
  return Boolean(getRouteRequirement(pathname));
}
