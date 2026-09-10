import type { ReactNode } from 'react';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
  icon?: ReactNode;
}

interface SegmentedToggleProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (next: T) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: SegmentedToggleProps<T>) {
  const active = options.findIndex((option) => option.value === value);

  return (
    <div
      className={className ? `fo-segmented ${className}` : 'fo-segmented'}
      role="tablist"
      aria-label={ariaLabel}
      data-count={options.length}
      data-index={active < 0 ? 0 : active}
    >
      <span className="fo-segmented-thumb" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? 'active' : ''}
          data-icon-only={option.label === '' ? 'true' : undefined}
          aria-label={option.label === '' ? (option.title ?? option.value) : undefined}
          title={option.title ?? undefined}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
