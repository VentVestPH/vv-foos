import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const QUICK_SEARCH_PARAM = 'search';

export interface SubmittedSearch {
  input: string;
  setInput: (next: string) => void;
  term: string;
  submit: (next: string) => void;
}

export function useSubmittedSearch(): SubmittedSearch {
  const [params] = useSearchParams();
  const initial = params.get(QUICK_SEARCH_PARAM) ?? '';
  const [input, setInput] = useState(initial);
  const [term, setTerm] = useState(initial);
  const applied = useRef(initial);

  useEffect(() => {
    const next = params.get(QUICK_SEARCH_PARAM);
    if (next === null || next === applied.current) return;
    applied.current = next;
    setInput(next);
    setTerm(next);
  }, [params]);

  const submit = useCallback((next: string) => {
    applied.current = next;
    setInput(next);
    setTerm(next);
  }, []);

  return { input, setInput, term, submit };
}

export function searchWords(term: string): string[] {
  return term.trim().toLowerCase().split(/\s+/).filter(Boolean);
}
