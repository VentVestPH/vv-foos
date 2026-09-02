import type { ReactNode } from 'react';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
}

export function Badge({ tone = 'neutral', children, title }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'hired':
    case 'won':
    case 'filled':
    case 'resolved':
    case 'Placed':
      return 'success';
    case 'on_hold':
    case 'waiting_approval':
    case 'pending':
      return 'warning';
    case 'rejected':
    case 'lost':
      return 'danger';
    case 'open':
    case 'offer':
    case 'client_interview':
    case 'negotiation':
    case 'proposal':
      return 'primary';
    case 'draft':
    case 'closed':
      return 'outline';
    default:
      return 'neutral';
  }
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status.replace(/_/g, ' ')}</Badge>;
}
