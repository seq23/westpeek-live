/**
 * A prefetch is not a click. Next's <Link> prefetches what is on screen in a production build, and
 * a GET that logs out logged the operator out the moment the launchpad rendered its "Log out
 * access" link: the next page they opened sent them back to the gate (found by the browser suite
 * on a production build, 6 Oct 2026). Any GET with a side effect answers a router or browser
 * prefetch without acting.
 */
export function isPrefetchRequest(headers: Headers) {
  if (headers.get("next-router-prefetch") === "1") return true;
  if (headers.get("x-middleware-prefetch") === "1") return true;
  return /prefetch/i.test(headers.get("purpose") || "") || /prefetch/i.test(headers.get("sec-purpose") || "");
}
