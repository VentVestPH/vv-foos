// Small local copy of the 1–3 star grade control (recruit module owns the
// original; module boundaries mean this one stays intake-local rather than
// cross-importing another module's component).
//
// Redesign (prompt section 8.8): same 1-3 star value semantics and onClick
// handlers as before — only the visual mark changed, from an emoji glyph to
// a restrained outline star in Taleo blue/gold (filled when graded, outline
// otherwise), rendered as inline SVG so it stays crisp at any size.

interface StarGradeProps {
  value: number | null;
  onChange?: (value: number | null) => void;
}

function StarMark({ on }: { on: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="star-mark"
    >
      <path
        d="M12 3.5l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.5l-5.1 2.7.98-5.68-4.13-4.02 5.7-.83z"
        fill={on ? 'var(--taleo-count, #c9a227)' : 'none'}
        stroke={on ? 'var(--taleo-count, #c9a227)' : 'var(--taleo-icon, #4a7098)'}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarGrade({ value, onChange }: StarGradeProps) {
  const grade = value ?? 0;
  if (!onChange) {
    return (
      <span className="star-grade" aria-label={grade ? `${grade} star grade` : 'Ungraded'}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= grade ? 'star on' : 'star'}>
            <StarMark on={i <= grade} />
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
          <StarMark on={i <= grade} />
        </button>
      ))}
    </span>
  );
}
