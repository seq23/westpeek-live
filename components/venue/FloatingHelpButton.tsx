export function FloatingHelpButton({ eventId }: { eventId: string }) {
  return (
    <a
      id="stage-help"
      href={`/venue/${eventId}/help`}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-30 rounded-full bg-brand-orange px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 print:hidden"
      aria-label="Open event help center"
      data-testid="floating-event-help"
    >
      Need help?
    </a>
  );
}
