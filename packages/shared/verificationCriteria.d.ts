export type VerificationCriteria = {
  requiresZwiftId?: boolean
  requiresMinimumAccountAge?: boolean
  minimumAccountAgeDays?: number
  requiresSpecificRoles?: string[]
  requiresServerBoost?: boolean
  requiresActivityThreshold?: boolean
}

export type VerificationFacts = {
  zwiftId: unknown
  accountCreatedAt: number
  roleIds: string[]
  isServerBooster: boolean
}

export const DEFAULT_VERIFICATION_CRITERIA: VerificationCriteria

export function evaluateVerificationCriteria(
  criteria: VerificationCriteria,
  facts: VerificationFacts,
  now?: number,
): {
  meetsAllCriteria: boolean
  criteriaResults: Record<string, boolean>
  missingCriteria: string[]
}
