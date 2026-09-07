import { Bookmark as BookmarkIcon, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MAX_BOOKMARKS, useBookmarks } from './useBookmarks';

function currentLabel(pathname: string): string {
  const heading = document.querySelector('h1');
  const text = heading?.textContent?.trim();
  return text && text.length > 0 ? text.slice(0, 42) : pathname;
}

export function BookmarkToggle() {
  const location = useLocation();
  const { add, remove, has, isFull } = useBookmarks();
  const href = location.pathname + location.search;
  const bookmarked = has(href);

  return (
    <button
      type="button"
      className={bookmarked ? 'fo-utility-icon is-active' : 'fo-utility-icon'}
      aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
      aria-pressed={bookmarked}
      title={
        bookmarked
          ? 'Remove bookmark'
          : isFull
            ? `Bookmark limit of ${MAX_BOOKMARKS} reached`
            : 'Bookmark this page'
      }
      disabled={!bookmarked && isFull}
      onClick={() => (bookmarked ? remove(href) : add({ href, label: currentLabel(location.pathname) }))}
    >
      <BookmarkIcon
        size={16}

        fill={bookmarked ? 'currentColor' : 'none'}
        aria-hidden="true"
      />
    </button>
  );
}

export function BookmarkBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookmarks, remove } = useBookmarks();

  if (bookmarks.length === 0) return null;

  return (
    <div className="fo-bookmark-bar" aria-label="Bookmarks">
      {bookmarks.map((bookmark) => (
        <span
          key={bookmark.href}
          className={
            bookmark.href === location.pathname + location.search
              ? 'fo-bookmark is-current'
              : 'fo-bookmark'
          }
        >
          <button type="button" onClick={() => navigate(bookmark.href)}>
            {bookmark.label}
          </button>
          <button
            type="button"
            className="fo-bookmark-remove"
            aria-label={`Remove bookmark ${bookmark.label}`}
            onClick={() => remove(bookmark.href)}
          >
            <X size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}
