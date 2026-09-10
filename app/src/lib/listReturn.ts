import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface ListReturnState {
  listUrl?: string;
  siblings?: string[];
}

export function useListLink() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (to: string, siblings?: string[]) => {
      navigate(to, {
        state: {
          listUrl: location.pathname + location.search,
          ...(siblings && siblings.length > 0 ? { siblings } : {}),
        },
      });
    },
    [navigate, location.pathname, location.search],
  );
}

export function useListReturnHref(fallback: string): string {
  const location = useLocation();
  const state = location.state as ListReturnState | null;
  return state?.listUrl ?? fallback;
}

export interface RecordSiblings {
  position: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
  go: (id: string) => void;
}

export function useRecordSiblings(basePath: string, currentId: string): RecordSiblings {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ListReturnState | null;
  const ids = state?.siblings ?? [];
  const index = ids.indexOf(currentId);

  const go = useCallback(
    (id: string) => {
      navigate(`${basePath}/${id}`, { state: location.state });
    },
    [navigate, basePath, location.state],
  );

  return {
    position: index < 0 ? 0 : index + 1,
    total: index < 0 ? 0 : ids.length,
    previousId: index > 0 ? (ids[index - 1] ?? null) : null,
    nextId: index >= 0 && index < ids.length - 1 ? (ids[index + 1] ?? null) : null,
    go,
  };
}
