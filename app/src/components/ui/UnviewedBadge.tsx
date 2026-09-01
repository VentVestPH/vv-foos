/**
 * Red count pill reading "n Unviewed" — the Taleo signal the team acts on.
 * Zero still renders nothing visible (architecture: "Zero renders nothing").
 *
 * G4, WCAG SC 4.1.3 Status Messages: this count is driven by Supabase Realtime
 * on `applications` and `application_views`, so it changes without any user
 * action. Discovery on 2026-09-01 found zero aria-live regions anywhere in the
 * app across seven files holding Realtime subscriptions, which meant a counter
 * dropping 3 -> 2 was announced to nobody and was invisible unless you happened
 * to be looking at that exact pixel.
 *
 * The wrapper is ALWAYS rendered, even at zero. A live region has to exist in
 * the DOM before the change for the change to be announced; one that appears at
 * the same moment as its content announces nothing. The wrapper is an empty
 * inline span at zero, so it occupies no space and nothing moves.
 */
export function UnviewedBadge({ count }: { count: number }) {
  return (
    <span aria-live="polite" aria-atomic="true">
      {count > 0 ? <span className="unviewed-badge">{count} Unviewed</span> : null}
    </span>
  );
}
