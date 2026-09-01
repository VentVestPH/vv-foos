export function UnviewedBadge({ count }: { count: number }) {
  return (
    <span aria-live="polite" aria-atomic="true">
      {count > 0 ? <span className="unviewed-badge">{count} Unviewed</span> : null}
    </span>
  );
}
