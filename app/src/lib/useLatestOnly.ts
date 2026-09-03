import { useCallback, useRef } from 'react';

export function useLatestOnly(): () => () => boolean {
  const seq = useRef(0);
  return useCallback(() => {
    seq.current += 1;
    const mine = seq.current;
    return () => mine === seq.current;
  }, []);
}
