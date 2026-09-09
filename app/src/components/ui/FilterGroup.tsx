import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function FilterGroup({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="fo-filter-group" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="fo-filter-group-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span className="fo-filter-group-chevron" aria-hidden="true">
          <ChevronDown size={20} />
        </span>
      </button>
      <div className="fo-filter-group-collapse" aria-hidden={open ? undefined : true}>
        <div className="fo-filter-group-clip">
          <div className="fo-filter-group-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function FilterFoot({ children }: { children: ReactNode }) {
  return <div className="fo-filter-foot">{children}</div>;
}
