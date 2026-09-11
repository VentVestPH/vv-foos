import { useCallback } from 'react';
import { useSectionCollapse } from '../components/ui/SectionCollapse';
import { printExpanded } from '../lib/printRecord';

export function usePrintRecord(): () => void {
  const collapse = useSectionCollapse();
  return useCallback(() => {
    printExpanded(() => collapse?.prepareForPrint());
  }, [collapse]);
}
