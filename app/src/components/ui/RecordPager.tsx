import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RecordPagerProps {
  noun: string;
  position: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
  onGo: (id: string) => void;
}

export function RecordPager({
  noun,
  position,
  total,
  previousId,
  nextId,
  onGo,
}: RecordPagerProps) {
  if (previousId === null && nextId === null) return null;

  const known = total > 0;
  const endTitle = (there: boolean, direction: string) =>
    there
      ? known
        ? `${direction} ${noun}`
        : `${direction} ${noun} by name`
      : `This is the ${direction === 'Previous' ? 'first' : 'last'} ${noun}${known ? ' on the list page you came from' : ' by name'}`;

  return (
    <nav className="fo-record-pager" aria-label={`${noun} paging`}>
      <button
        type="button"
        className="fo-icon-btn"
        aria-label={`Previous ${noun}`}
        title={endTitle(previousId !== null, 'Previous')}
        disabled={previousId === null}
        onClick={() => previousId !== null && onGo(previousId)}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      {known && (
        <span className="fo-record-pager-pos" aria-live="polite">
          {position} of {total}
        </span>
      )}
      <button
        type="button"
        className="fo-icon-btn"
        aria-label={`Next ${noun}`}
        title={endTitle(nextId !== null, 'Next')}
        disabled={nextId === null}
        onClick={() => nextId !== null && onGo(nextId)}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </nav>
  );
}
