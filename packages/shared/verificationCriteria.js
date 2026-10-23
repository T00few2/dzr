// Source of truth; copied to apps/bot by npm run sync:shared.
const DEFAULT_VERIFICATION_CRITERIA = {
  requiresZwiftId: true,
  requiresMinimumAccountAge: false,
  requiresSpecificRoles: [],
  requiresServerBoost: false,
  requiresActivityThreshold: false, // Reserved; not currently enforced by verification.
};

/** Evaluate known facts only. Callers must not turn failed lookups into missing criteria. */
function evaluateVerificationCriteria(criteria, facts, now = Date.now()) {
  const criteriaResults = {};
  const missingCriteria = [];

  if (criteria.requiresZwiftId) {
    criteriaResults.hasZwiftId = !!facts.zwiftId;
    if (!criteriaResults.hasZwiftId) missingCriteria.push("Linked ZwiftID");
  }

  if (criteria.requiresMinimumAccountAge && criteria.minimumAccountAgeDays) {
    const accountAge = (now - facts.accountCreatedAt) / (1000 * 60 * 60 * 24);
    criteriaResults.accountAge = accountAge >= criteria.minimumAccountAgeDays;
    if (!criteriaResults.accountAge) {
      missingCriteria.push(`Account age (${criteria.minimumAccountAgeDays} days minimum)`);
    }
  }

  if (criteria.requiresSpecificRoles?.length) {
    const missingRoles = criteria.requiresSpecificRoles.filter(roleId => !facts.roleIds.includes(roleId));
    criteriaResults.hasRequiredRoles = missingRoles.length === 0;
    if (missingRoles.length) missingCriteria.push(`Required roles: ${missingRoles.length} missing`);
  }

  if (criteria.requiresServerBoost) {
    criteriaResults.isServerBooster = facts.isServerBooster;
    if (!facts.isServerBooster) missingCriteria.push("Server boost");
  }

  return { meetsAllCriteria: missingCriteria.length === 0, criteriaResults, missingCriteria };
}

module.exports = { DEFAULT_VERIFICATION_CRITERIA, evaluateVerificationCriteria };
