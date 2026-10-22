const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_VERIFICATION_CRITERIA, evaluateVerificationCriteria } = require('./verificationCriteria');

const now = Date.UTC(2026, 9, 22);
const facts = { zwiftId: '12345', accountCreatedAt: now - 30 * 86400000, roleIds: ['community'], isServerBooster: true };

test('the default verification criterion is a linked Zwift ID', () => {
  assert.equal(evaluateVerificationCriteria(DEFAULT_VERIFICATION_CRITERIA, facts, now).meetsAllCriteria, true);
  assert.deepEqual(evaluateVerificationCriteria(DEFAULT_VERIFICATION_CRITERIA, { ...facts, zwiftId: null }, now), {
    meetsAllCriteria: false, criteriaResults: { hasZwiftId: false }, missingCriteria: ['Linked ZwiftID'],
  });
});

test('all configured criteria must pass, including the exact minimum account age', () => {
  const criteria = { requiresZwiftId: true, requiresMinimumAccountAge: true, minimumAccountAgeDays: 30, requiresSpecificRoles: ['community'], requiresServerBoost: true };
  assert.deepEqual(evaluateVerificationCriteria(criteria, facts, now), {
    meetsAllCriteria: true,
    criteriaResults: { hasZwiftId: true, accountAge: true, hasRequiredRoles: true, isServerBooster: true },
    missingCriteria: [],
  });
  const failures = evaluateVerificationCriteria(criteria, {
    zwiftId: null, accountCreatedAt: facts.accountCreatedAt + 1, roleIds: [], isServerBooster: false,
  }, now);
  assert.equal(failures.meetsAllCriteria, false);
  assert.deepEqual(failures.missingCriteria, ['Linked ZwiftID', 'Account age (30 days minimum)', 'Required roles: 1 missing', 'Server boost']);
});

test('disabled criteria and the unused activity setting do not introduce new requirements', () => {
  assert.equal(evaluateVerificationCriteria({ requiresZwiftId: false, requiresActivityThreshold: true }, {}, now).meetsAllCriteria, true);
});
