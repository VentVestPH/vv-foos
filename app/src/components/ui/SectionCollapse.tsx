import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

type Setter = (open: boolean) => void;

interface SectionCollapseValue {
  register: (key: string, setter: Setter, open: boolean) => () => void;
  report: (key: string, open: boolean) => void;
  setAll: (open: boolean) => void;
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
  const setters = useRef(new Map<string, Setter>());
  const [openByKey, setOpenByKey] = useState<Record<string, boolean>>({});

  const register = useCallback((key: string, setter: Setter, open: boolean) => {
    setters.current.set(key, setter);
    setOpenByKey((prev) => ({ ...prev, [key]: open }));
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
    for (const setter of setters.current.values()) setter(open);
  }, []);

  const api = useMemo<SectionCollapseValue>(
    () => ({ register, report, setAll }),
    [register, report, setAll],
  );

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
