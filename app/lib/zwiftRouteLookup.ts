import { flaskData } from '@/app/api/admin/_lib/flask'
import { chooseZwiftRoute } from '@/packages/shared/zwiftRouteMatch'

export type ZwiftRouteHit = { routeId: number; name: string; world: string | null }

export async function findZwiftRoute(routeName: string): Promise<ZwiftRouteHit> {
  const result = await flaskData(`/api/zwift/routes?q=${encodeURIComponent(routeName)}`)
  if (result.status >= 400) {
    throw new Error(String(result.body?.error || 'Route search failed'))
  }
  const hits: ZwiftRouteHit[] = Array.isArray(result.body) ? result.body : []
  const chosen = chooseZwiftRoute(hits, routeName)
  if (!chosen?.routeId) throw new Error(`Could not match a single Zwift route for ${routeName}`)
  return {
    routeId: Number(chosen.routeId),
    name: String(chosen.name || routeName),
    world: chosen.world ? String(chosen.world) : null,
  }
}
