import { Select } from './Select';

export const GRADE_OPTIONS = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'F', label: 'F' },
];

interface LetterGradeSelectProps {
  value: string;
  label: string;
  onChange: (value: string) => void;
  className?: string;
}

export function LetterGradeSelect({ value, label, onChange, className }: LetterGradeSelectProps) {
  return (
    <Select
      {...(className !== undefined ? { className } : {})}
      aria-label={label}
      title={label}
      placeholder="-"
      options={GRADE_OPTIONS}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
