/** Where a refused crew sign-in lands: the reason the gate gave, as the page's ?error=. */
export function crewRefusalQuery(reason: string | undefined, invalidPassword: boolean) {
  if (reason === "rotated") return "error=rotated";
  if (reason === "host_link_required") return "error=host_only";
  return invalidPassword ? "error=invalid" : "error=invalid_event";
}
