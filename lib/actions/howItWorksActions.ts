"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperatorAccessForRequest } from "@/lib/auth/operatorRequestGuard";
import { createAuditLog } from "@/services/audit/createAuditLog";
import { howItWorksPath, saveHowItWorksPage } from "@/services/content/howItWorksService";
import { isHowItWorksAudience } from "@/types/howItWorks";

/**
 * Editing an instruction page.
 *
 * Owner and operator only, checked here on the server rather than by hiding the form: the form
 * being absent is a courtesy to everyone else, this is the actual rule. Every save records who
 * made it, and the page it writes is the same one every instruction email already links to, so the
 * correction reaches the people who were mailed last month as well as the ones mailed today.
 */
export async function saveHowItWorksPageAction(formData: FormData) {
  const auth = await requireOperatorAccessForRequest();
  if (!auth.ok) throw new Error(auth.error);

  const slug = String(formData.get("slug") || "");
  if (!isHowItWorksAudience(slug)) throw new Error("That is not one of the instruction pages.");

  const result = await saveHowItWorksPage({
    slug,
    title: String(formData.get("title") || ""),
    intro: String(formData.get("intro") || ""),
    body: String(formData.get("body") || ""),
    updatedBy: auth.actorRole,
    updatedByLabel: auth.actorRole === "owner" ? "Owner" : "Operator",
  });

  if (!result.ok) redirect(`${howItWorksPath(slug)}?editError=${encodeURIComponent(result.reason)}`);

  await createAuditLog({
    agencyId: "west-peek-productions",
    actorUserId: auth.actorRole,
    actorRole: auth.actorRole,
    action: "how_it_works_page_edited",
    resourceType: "how_it_works_page",
    resourceId: slug,
    visibility: "internal_agency",
  });

  revalidatePath(howItWorksPath(slug));
  redirect(`${howItWorksPath(slug)}?saved=1`);
}
