// Types for the shared membership gate.

export type MembershipCollections = { memberships: string; payments: string }

/**
 * Paid DZR club membership for the current year. Discord roles are not sufficient.
 * Fails closed — any error returns false rather than admitting someone.
 */
export function isPaidClubMember(
  db: any,
  collections: MembershipCollections,
  discordId: string
): Promise<boolean>
