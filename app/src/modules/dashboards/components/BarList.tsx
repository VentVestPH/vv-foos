interface BarListProps {
  items: { label: string; count: number; tone?: 'primary' | 'success' | 'warning' | 'danger' }[];
  onBarClick?: (label: string) => void;
}

export function BarList({ items, onBarClick }: BarListProps) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="dash-barlist">
      {items.map((item) => {
        const inner = (
          <>
            <span className="dash-barlist-label">{item.label.replace(/_/g, ' ')}</span>
            <span className="dash-barlist-track">
              <span
                className={`dash-barlist-fill tone-${item.tone ?? 'primary'}`}
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </span>
            <span className="dash-barlist-count">{item.count}</span>
          </>
        );
        return onBarClick ? (
          <button
            key={item.label}
            type="button"
            className="dash-barlist-row clickable"
            onClick={() => onBarClick(item.label)}
          >
            {inner}
          </button>
        ) : (
          <div key={item.label} className="dash-barlist-row">
            {inner}
          </div>
        );
      })}
      {items.length === 0 && <p className="dash-empty">No data in range.</p>}
    </div>
  );
}
