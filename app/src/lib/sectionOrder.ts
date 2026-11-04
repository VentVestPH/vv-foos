export function mergeSectionOrder(saved: string[], defaults: string[]): string[] {
  const known = new Set(defaults);
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const section of saved) {
    if (known.has(section) && !seen.has(section)) {
      merged.push(section);
      seen.add(section);
    }
  }
  defaults.forEach((section, index) => {
    if (seen.has(section)) return;
    let at = 0;
    for (let back = index - 1; back >= 0; back -= 1) {
      const anchor = defaults[back];
      const found = anchor === undefined ? -1 : merged.indexOf(anchor);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    merged.splice(at, 0, section);
    seen.add(section);
  });
  return merged;
}

export function moveSection(order: string[], from: number, to: number): string[] {
  if (to < 0 || to >= order.length || from === to || from < 0 || from >= order.length) return order;
  const next = [...order];
  const [section] = next.splice(from, 1);
  if (section === undefined) return order;
  next.splice(to, 0, section);
  return next;
}

export function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((section, index) => section === b[index]);
}
