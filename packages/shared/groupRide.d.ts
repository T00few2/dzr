export type GroupRideRoute = { routeId: number; name: string; world: string | null }

export function groupRideRoute(
  routes: GroupRideRoute[],
  anchorDate: string,
  anchorIndex: number,
  overrides: Record<string, number> | null | undefined,
  date: string
): GroupRideRoute | null
