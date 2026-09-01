import type { ReactNode } from 'react';

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="dash-kpi">
      <span className="dash-kpi-label">{label}</span>
      <span className="dash-kpi-value">{value}</span>
      {hint && <span className="dash-kpi-hint">{hint}</span>}
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="dash-kpi-row">{children}</div>;
}
