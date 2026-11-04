export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'];
export const BUDGET_STATUSES = ['Approved', 'Pending', 'Not budgeted'];
export const REOPEN_REASONS = ['New position', 'Replacement', 'Expansion', 'Other'];

export function optionsWithCurrent(
  choices: string[],
  current: string | null,
): { value: string; label: string }[] {
  const all = current && !choices.includes(current) ? [...choices, current] : choices;
  return all.map((v) => ({ value: v, label: v }));
}
