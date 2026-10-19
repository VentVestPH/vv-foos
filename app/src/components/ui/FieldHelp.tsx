import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';

export function FieldHelp({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <span
      className="field-help"
      ref={wrap}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="fo-icon-btn field-help-btn"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <CircleHelp size={16} aria-hidden="true" />
      </button>
      {open && (
        <span id={popId} role="note" className="field-help-pop">
          {children}
        </span>
      )}
    </span>
  );
}
