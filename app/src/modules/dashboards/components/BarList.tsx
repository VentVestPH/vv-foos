// Hand-rolled horizontal bar list — no charting library is installed
// anywhere in this app yet (package.json is outside this module's write
// boundary, same rule the other modules follow), so every dashboard visual
// here is plain CSS bars over the locked design tokens rather than a new
// dependency. Good enough for stage counts / source splits at this volume.

interface BarListProps {
  items: { label: string; count: number; tone?: 'primary' | 'success' | 'warning' | 'danger' }[];
  onBarClick?: (label: string) => void;
}

export function BarList({ items, onBarClick }: BarListProps) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="dash-barlist">
      {items.map((item) => (
        <div
          key={item.label}
          className={onBarClick ? 'dash-barlist-row clickable' : 'dash-barlist-row'}
          onClick={onBarClick ? () => onBarClick(item.label) : undefined}
        >
          <span className="dash-barlist-label">{item.label.replace(/_/g, ' ')}</span>
          <div className="dash-barlist-track">
            <div
              className={`dash-barlist-fill tone-${item.tone ?? 'primary'}`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="dash-barlist-count">{item.count}</span>
        </div>
      ))}
      {items.length === 0 && <p className="dash-empty">No data in range.</p>}
    </div>
  );
}
