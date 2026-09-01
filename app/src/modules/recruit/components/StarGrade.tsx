/**
 * C7 / D13. The star was the text glyph U+2605. Redesign prompt section 8.8
 * asks for "restrained Taleo blue/gold outline styling rather than emoji".
 * The sibling copy in modules/intake was converted at redesign time and this
 * one was missed, so the two rendered differently. Both now use Lucide.
 */
import { Star } from 'lucide-react';

interface StarGradeProps {
  /** 1–3 per the VVPH one/two/three-star convention; null = ungraded. */
  value: number | null;
  /** When present, stars are clickable; clicking the current value clears it. */
  onChange?: (value: number | null) => void;
}

/** 1–3 star grade, display or edit. Edit rights follow the RLS matrix. */
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
