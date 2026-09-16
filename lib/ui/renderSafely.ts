/**
 * The fail-soft core behind SafeSection, kept free of JSX so it is unit-testable: run the
 * section's render inside a try; a throw (sync or async) becomes a named, bounded message.
 */
export type SafeRender<T> = { ok: true; node: T } | { ok: false; label: string; message: string };

export async function renderSafely<T>(label: string, render: () => Promise<T> | T): Promise<SafeRender<T>> {
  try {
    return { ok: true, node: await render() };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 200);
    console.warn(`section unavailable: ${label}`, message);
    return { ok: false, label, message };
  }
}
