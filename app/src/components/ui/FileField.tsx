import { useId, useState, type ChangeEvent, type RefObject } from 'react';

interface FileFieldProps {
  label: string;
  buttonLabel?: string;
  accept?: string;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  onFile: (file: File) => void;
}

export function FileField({
  label,
  buttonLabel = 'Choose a file',
  accept,
  disabled = false,
  inputRef,
  onFile,
}: FileFieldProps) {
  const inputId = useId();
  const nameId = `${inputId}-name`;
  const [chosen, setChosen] = useState<string | null>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setChosen(file ? file.name : null);
    if (file) onFile(file);
  };

  return (
    <div className="field file-field">
      <div className="file-field-row">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="file-field-input"
          aria-label={label}
          aria-describedby={nameId}
          disabled={disabled}
          {...(accept === undefined ? {} : { accept })}
          onChange={onChange}
        />
        <label htmlFor={inputId} className="btn btn-secondary file-field-btn">
          {buttonLabel}
        </label>
        <span className="file-field-name" id={nameId}>
          {chosen ?? 'No file chosen'}
        </span>
      </div>
    </div>
  );
}
