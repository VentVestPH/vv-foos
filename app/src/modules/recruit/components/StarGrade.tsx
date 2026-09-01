import { Star } from 'lucide-react';

interface StarGradeProps {
  value: number | null;

  onChange?: (value: number | null) => void;
}

export function StarGrade({ value, onChange }: StarGradeProps) {
  const grade = value ?? 0;

  if (!onChange) {
    return (
      <span
        className="star-grade"
        aria-label={grade ? `${grade} star grade` : 'Ungraded'}
      >
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= grade ? 'star on' : 'star'}>
            <Star size={14} strokeWidth={1.6} fill={i <= grade ? 'currentColor' : 'none'} />
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="star-grade editable" role="radiogroup" aria-label="Star grade">
      {[1, 2, 3].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={grade === i}
          className={i <= grade ? 'star on' : 'star'}
          title={i === 1 ? '1 star' : `${i} stars`}
          onClick={(e) => {
            e.stopPropagation();
            onChange(grade === i ? null : i);
          }}
        >
          <Star size={14} strokeWidth={1.6} fill={i <= grade ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  );
}
