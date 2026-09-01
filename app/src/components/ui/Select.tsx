import { useId, type SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];

  placeholder?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  required,
  id,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;

  const select = (
    <select id={selectId} required={required} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  if (!label && !error) {
    return <div className="field">{select}</div>;
  }

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={selectId}>
          {label}
          {required && <span className="field-required"> *</span>}
        </label>
      )}
      {select}
      {error && <span className="field-error-text">{error}</span>}
    </div>
  );
}
