import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { redactSecrets } from '@/app/lib/tokenCrypto'

const BLOCKED = new Set([
  COLLECTIONS.stravaConnections,
  COLLECTIONS.coachProfiles,
  COLLECTIONS.payments,
])

export const ADMIN_COLLECTION_ALLOWED = new Set(
  Object.values(COLLECTIONS).filter((name) => !BLOCKED.has(name))
)

export function isBlockedAdminCollection(name: string): boolean {
  return BLOCKED.has(name) || !ADMIN_COLLECTION_ALLOWED.has(name)
}

export function redactAdminDoc(id: string, data: Record<string, any>) {
  return { id, ...redactSecrets(data || {}) }
}
