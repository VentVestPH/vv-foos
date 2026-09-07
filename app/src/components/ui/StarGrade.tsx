import { Star } from 'lucide-react';

interface StarGradeProps {
  value: number | null;
  size?: number;
  subject?: string;
  onChange?: (value: number | null) => void;
}

const GRADES = [1, 2, 3];

export function StarGrade({ value, size = 14, subject, onChange }: StarGradeProps) {
  const grade = value ?? 0;
  const of = subject !== undefined && subject !== '' ? ` for ${subject}` : '';

  if (!onChange) {
    return (
      <span
        className="star-grade"
        role="img"
        aria-label={grade ? `${grade} star grade${of}` : `Ungraded${of}`}
      >
        {GRADES.map((i) => (
          <span key={i} className={i <= grade ? 'star on' : 'star'}>
            <Star size={size} fill={i <= grade ? 'currentColor' : 'none'} />
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="star-grade editable" role="radiogroup" aria-label={`Star grade${of}`}>
      {GRADES.map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={grade === i}
          className={i <= grade ? 'star on' : 'star'}
          aria-label={i === 1 ? `1 star${of}` : `${i} stars${of}`}
          title={i === 1 ? '1 star' : `${i} stars`}
          onClick={(e) => {
            e.stopPropagation();
            onChange(grade === i ? null : i);
          }}
        >
          <Star size={size} fill={i <= grade ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  );
}
