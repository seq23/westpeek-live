import type { ReactNode } from "react";
import { type CrewViewer, viewerDenied } from "@/lib/auth/crewViewer";
import type { CrewAction } from "@/lib/auth/crewRolePermissions";

/**
 * A server-action form that the viewer's role may or may not use. Allowed: the plain form.
 * Denied: the same controls, rendered disabled inside a fieldset that carries the reason
 * ("Moderator can't move the stream or end the show — that's …") as its title, with the reason
 * marked for screen readers. The server action refuses with the identical sentence, so a crafted
 * request gets the same answer the button shows.
 */
export function GatedForm({ viewer, action: permission, formAction, className, children, testId }: { viewer: CrewViewer; action: CrewAction; formAction: (formData: FormData) => void | Promise<void>; className?: string; children: ReactNode; testId?: string }) {
  const reason = viewerDenied(viewer, permission);
  if (!reason) return <form action={formAction} className={className} data-testid={testId}>{children}</form>;
  return (
    <form className={className} data-testid={testId} data-crew-denied={permission} title={reason}>
      <fieldset disabled className="contents" title={reason}>{children}</fieldset>
      <span className="sr-only">{reason}</span>
    </form>
  );
}

/** The visible reason line for a section whose controls are disabled for this viewer. */
export function DeniedNote({ viewer, action, className = "" }: { viewer: CrewViewer; action: CrewAction; className?: string }) {
  const reason = viewerDenied(viewer, action);
  if (!reason) return null;
  return <p className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 ${className}`} data-testid={`crew-denied-${action}`} role="note">{reason}</p>;
}
