import type { ReactNode } from 'react';

interface InfoGroupProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function InfoGroup({ label, hint, children }: InfoGroupProps) {
  return (
    <section className="info-group">
      <h3 className="info-group-label">{label}</h3>
      {hint !== undefined && <p className="info-group-hint">{hint}</p>}
      {children}
    </section>
  );
}
