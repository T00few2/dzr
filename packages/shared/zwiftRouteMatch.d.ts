export function chooseZwiftRoute<T extends { name?: string | null }>(
  hits: T[],
  query: string
): T | null
