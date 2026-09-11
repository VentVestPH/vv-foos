import { useEffect, useRef } from 'react';
import { CircleAlert } from 'lucide-react';

export interface FieldError {
  field?: string;
  message: string;
}

interface ErrorSummaryProps {
  errors: FieldError[];
  title?: string;
}

export function ErrorSummary({ errors, title = 'There is a problem' }: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const signature = errors.map((e) => `${e.field ?? ''}:${e.message}`).join('|');

  useEffect(() => {
    if (signature !== '') ref.current?.focus();
  }, [signature]);

  if (errors.length === 0) return null;

  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <h2 className="error-summary-title">
        <CircleAlert size={20} aria-hidden="true" />
        {title}
      </h2>
      <ul className="error-summary-list">
        {errors.map((e) => (
          <li key={`${e.field ?? ''}:${e.message}`}>
            {e.field === undefined ? (
              e.message
            ) : (
              <a
                href={`#${e.field}`}
                onClick={(event) => {
                  event.preventDefault();
                  const target = document.getElementById(e.field ?? '');
                  target?.focus();
                  target?.scrollIntoView({ block: 'center' });
                }}
              >
                {e.message}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
