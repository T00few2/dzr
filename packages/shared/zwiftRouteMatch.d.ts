export function foldRouteName(value: unknown): string

export function chooseZwiftRoute<T extends { name?: string | null }>(
  hits: T[],
  query: string
): T | null
