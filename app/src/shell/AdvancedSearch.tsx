import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const EXIT_MS = 140;

const NARROW_QUERY = '(max-width: 900px)';

interface AdvancedSearchApi {
  node: ReactNode;
  open: boolean;
  closing: boolean;
  narrow: boolean;
  columnFocusRequest: number;
  publish: (node: ReactNode) => void;
  reset: () => void;
  openPanel: () => void;
  requestClose: () => void;
  toggle: () => void;
  requestColumnFocus: () => void;
}

const AdvancedSearchContext = createContext<AdvancedSearchApi | null>(null);

export function AdvancedSearchProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [columnFocusRequest, setColumnFocusRequest] = useState(0);
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const publish = useCallback((next: ReactNode) => setNode(next), []);

  const reset = useCallback(() => {
    clearTimer();
    setNode(null);
    setOpen(false);
    setClosing(false);
  }, [clearTimer]);

  const openPanel = useCallback(() => {
    clearTimer();
    setClosing(false);
    setOpen(true);
  }, [clearTimer]);

  const requestClose = useCallback(() => {
    if (timer.current !== null) return;
    setClosing(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setClosing(false);
      setOpen(false);
    }, EXIT_MS);
  }, []);

  const toggle = useCallback(() => {
    if (open && timer.current === null) {
      requestClose();
      return;
    }
    openPanel();
  }, [open, openPanel, requestClose]);

  useEffect(() => clearTimer, [clearTimer]);

  const requestColumnFocus = useCallback(() => setColumnFocusRequest((n) => n + 1), []);

  const api = useMemo<AdvancedSearchApi>(
    () => ({
      node,
      open,
      closing,
      narrow,
      columnFocusRequest,
      publish,
      reset,
      openPanel,
      requestClose,
      toggle,
      requestColumnFocus,
    }),
    [
      node,
      open,
      closing,
      narrow,
      columnFocusRequest,
      publish,
      reset,
      openPanel,
      requestClose,
      toggle,
      requestColumnFocus,
    ],
  );

  return (
    <AdvancedSearchContext.Provider value={api}>{children}</AdvancedSearchContext.Provider>
  );
}

export function useAdvancedSearch(): AdvancedSearchApi {
  const api = useContext(AdvancedSearchContext);
  if (!api) throw new Error('useAdvancedSearch requires an AdvancedSearchProvider ancestor');
  return api;
}

export function usePublishAdvancedSearch(node: ReactNode): void {
  const { publish, reset } = useAdvancedSearch();
  useEffect(() => {
    publish(node ?? null);
  }, [node, publish]);
  useEffect(() => reset, [reset]);
}
