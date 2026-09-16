/**
 * The Production OS sidebar's items, and the one rule for which of them is "where you are".
 *
 * Longest matching prefix wins, and /app is exact so Dashboard does not light up on every page.
 * Deep pages resolve to their section: /app/events/anything lights Events (except /app/events/new,
 * which is its own item), /admin/testing/anything lights the Testing Console.
 */
export interface WorkspaceNavItem {
  label: string;
  href: string;
  /** Exact match only (Dashboard). Everything else matches by prefix. */
  exact?: boolean;
}

export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { label: "Owner console", href: "/app/owner" },
  { label: "Dashboard", href: "/app", exact: true },
  { label: "Clients", href: "/app/clients" },
  { label: "People", href: "/app/people" },
  { label: "Events", href: "/app/events" },
  { label: "Email", href: "/app/email" },
  { label: "Templates", href: "/app/templates" },
  { label: "Contractors", href: "/app/contractors" },
  { label: "Vendors", href: "/app/vendors" },
  { label: "Assets", href: "/app/assets" },
  { label: "Settings", href: "/app/settings" },
  { label: "Testing Console", href: "/admin/testing" },
];

/** The New event button is a call to action, not a place — but when you ARE there, it is current. */
export const NEW_EVENT_ITEM: WorkspaceNavItem = { label: "New event", href: "/app/events/new" };

function matches(item: WorkspaceNavItem, pathname: string) {
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  if (item.exact) return clean === item.href;
  return clean === item.href || clean.startsWith(`${item.href}/`);
}

/** The href of the item that is current, or undefined when the path belongs to none of them. */
export function activeNavHref(pathname: string): string | undefined {
  const candidates = [NEW_EVENT_ITEM, ...WORKSPACE_NAV].filter((item) => matches(item, pathname));
  if (!candidates.length) return undefined;
  return candidates.sort((a, b) => b.href.length - a.href.length)[0].href;
}
