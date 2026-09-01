import { useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, required, id, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  if (!label && !error) {
    return <input id={inputId} className="input" required={required} {...rest} />;
  }

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={inputId}>
          {label}
          {required && <span className="field-required"> *</span>}
        </label>
      )}
      <input id={inputId} required={required} {...rest} />
      {error && <span className="field-error-text">{error}</span>}
    </div>
  );
}
