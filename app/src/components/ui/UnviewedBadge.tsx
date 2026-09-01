/**
 * Taleo's "n Unviewed" signal. Zero renders nothing visible.
 *
 * The wrapper is always rendered, even at zero: a live region has to exist in
 * the DOM before the change for the change to be announced. The count is driven
 * by Realtime, so it changes with no user action.
 */
export function UnviewedBadge({ count }: { count: number }) {
  return (
    <span aria-live="polite" aria-atomic="true">
      {count > 0 ? <span className="unviewed-badge">{count} Unviewed</span> : null}
    </span>
  );
}
