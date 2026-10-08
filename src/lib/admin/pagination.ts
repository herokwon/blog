/** Inputs are validated query values and server totals. */
export function pageNumbers(page: number, totalPages: number): number[] {
  const first = Math.floor((page - 1) / 5) * 5 + 1;
  return Array.from(
    { length: Math.max(0, Math.min(5, totalPages - first + 1)) },
    (_, index) => first + index,
  );
}

export function pageAfterMutation(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages));
}
