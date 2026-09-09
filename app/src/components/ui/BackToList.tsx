import { ArrowLeft } from 'lucide-react';
import { useBackToList } from '../../lib/listReturn';

interface BackToListProps {
  fallback: string;
  label?: string;
}

export function BackToList({ fallback, label = 'Back to list' }: BackToListProps) {
  const back = useBackToList(fallback);
  return (
    <button type="button" className="fo-back-to-list" onClick={back}>
      <ArrowLeft size={20} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
