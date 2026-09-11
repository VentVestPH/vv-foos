import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SCROLLER_ID = 'main-content';

export function useScrollReset(): void {
  const location = useLocation();

  useLayoutEffect(() => {
    if (location.hash) return;
    const scroller = document.getElementById(SCROLLER_ID);
    if (scroller) scroller.scrollTop = 0;
  }, [location.key, location.hash]);
}
