import { Star } from 'lucide-react';

interface StarGradeProps {
  value: number | null;
  size?: number;
  onChange?: (value: number | null) => void;
}

const GRADES = [1, 2, 3];

export function StarGrade({ value, size = 14, onChange }: StarGradeProps) {
  const grade = value ?? 0;

  if (!onChange) {
    return (
      <span
        className="star-grade"
        role="img"
        aria-label={grade ? `${grade} star grade` : 'Ungraded'}
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
    <span className="star-grade editable" role="radiogroup" aria-label="Star grade">
      {GRADES.map((i) => (
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
          <Star size={size} fill={i <= grade ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  );
}
