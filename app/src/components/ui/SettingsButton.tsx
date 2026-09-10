import { SlidersHorizontal } from 'lucide-react';

interface SettingsButtonProps {
  label: string;
  title?: string;
  className?: string;
  onClick: () => void;
}

export function SettingsButton({ label, title, className, onClick }: SettingsButtonProps) {
  return (
    <button
      type="button"
      className={className === undefined ? 'fo-gear-btn' : `fo-gear-btn ${className}`}
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
    >
      <SlidersHorizontal size={20} aria-hidden="true" />
    </button>
  );
}
