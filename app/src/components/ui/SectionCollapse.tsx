import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

type Setter = (open: boolean) => void;
type Reader = () => boolean;

interface Section {
  set: Setter;
  read: Reader;
}

interface SectionCollapseValue {
  register: (key: string, setter: Setter, read: Reader) => () => void;
  report: (key: string, open: boolean) => void;
  setAll: (open: boolean) => void;
  prepareForPrint: () => void;
}

interface SectionCollapseState {
  count: number;
  allOpen: boolean;
}

const SectionCollapseContext = createContext<SectionCollapseValue | null>(null);
const SectionCollapseStateContext = createContext<SectionCollapseState>({
  count: 0,
  allOpen: false,
});

export function SectionCollapseProvider({ children }: { children: ReactNode }) {
  const setters = useRef(new Map<string, Section>());
  const [openByKey, setOpenByKey] = useState<Record<string, boolean>>({});

  const register = useCallback((key: string, setter: Setter, read: Reader) => {
    setters.current.set(key, { set: setter, read });
    setOpenByKey((prev) => ({ ...prev, [key]: read() }));
    return () => {
      setters.current.delete(key);
      setOpenByKey((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };
  }, []);

  const report = useCallback((key: string, open: boolean) => {
    setOpenByKey((prev) => (prev[key] === open ? prev : { ...prev, [key]: open }));
  }, []);

  const setAll = useCallback((open: boolean) => {
    for (const section of setters.current.values()) section.set(open);
  }, []);

  const beforePrint = useRef<Record<string, boolean> | null>(null);

  const prepareForPrint = useCallback(() => {
    if (beforePrint.current === null) {
      const snapshot: Record<string, boolean> = {};
      for (const [key, section] of setters.current.entries()) snapshot[key] = section.read();
      beforePrint.current = snapshot;
    }
    flushSync(() => setAll(true));
  }, [setAll]);

  const api = useMemo<SectionCollapseValue>(
    () => ({ register, report, setAll, prepareForPrint }),
    [register, report, setAll, prepareForPrint],
  );

  useEffect(() => {
    const restore = () => {
      const snapshot = beforePrint.current;
      beforePrint.current = null;
      if (!snapshot) return;
      flushSync(() => {
        for (const [key, section] of setters.current.entries()) {
          const was = snapshot[key];
          if (was !== undefined) section.set(was);
        }
      });
    };
    window.addEventListener('beforeprint', prepareForPrint);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', prepareForPrint);
      window.removeEventListener('afterprint', restore);
    };
  }, [prepareForPrint]);

  const state = useMemo<SectionCollapseState>(() => {
    const keys = Object.keys(openByKey);
    return {
      count: keys.length,
      allOpen: keys.length > 0 && keys.every((key) => openByKey[key] === true),
    };
  }, [openByKey]);

  return (
    <SectionCollapseContext.Provider value={api}>
      <SectionCollapseStateContext.Provider value={state}>
        {children}
      </SectionCollapseStateContext.Provider>
    </SectionCollapseContext.Provider>
  );
}

export function useSectionCollapse(): SectionCollapseValue | null {
  return useContext(SectionCollapseContext);
}

export function CollapseAllButton() {
  const bus = useContext(SectionCollapseContext);
  const { count, allOpen } = useContext(SectionCollapseStateContext);
  if (!bus || count === 0) return null;
  const label = allOpen ? 'Minimize all sections' : 'Maximize all sections';
  return (
    <button
      type="button"
      className="fo-icon-btn fo-collapse-all"
      aria-label={label}
      title={allOpen ? 'Minimize all' : 'Maximize all'}
      onClick={() => bus.setAll(!allOpen)}
    >
      <span className="fo-collapse-all-glyph" data-all-open={allOpen ? 'true' : 'false'}>
        <ChevronsDownUp size={20} aria-hidden="true" />
        <ChevronsUpDown size={20} aria-hidden="true" />
      </span>
    </button>
  );
}
