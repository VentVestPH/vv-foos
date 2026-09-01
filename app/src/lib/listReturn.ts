import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface ListReturnState {
  listUrl?: string;
}

export function useListLink() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (to: string) => {
      navigate(to, { state: { listUrl: location.pathname + location.search } });
    },
    [navigate, location.pathname, location.search],
  );
}

export function useBackToList(fallback: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ListReturnState | null;
  const target = state?.listUrl ?? fallback;

  return useCallback(() => navigate(target), [navigate, target]);
}
