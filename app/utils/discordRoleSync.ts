import { VERIFIED_MEMBER_ROLE_ID } from '@/app/lib/sharedConstants'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import {
  DEFAULT_VERIFICATION_CRITERIA,
  evaluateVerificationCriteria,
  type VerificationCriteria,
  type VerificationFacts,
} from '@/packages/shared/verificationCriteria'

type RoleSyncResult =
  | { status: 'succeeded'; roleId: string }
  | { status: 'queued'; roleId: string; roleUpdateId: string }
  | { status: 'skipped'; reason: string }

async function discordAddRole(guildId: string, discordId: string, roleId: string, botToken: string) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bot ${botToken}` },
  })
  if (!resp.ok) throw new Error(`Failed to add role: ${resp.status}`)
}

async function discordRemoveRole(guildId: string, discordId: string, roleId: string, botToken: string) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${botToken}` },
  })
  if (!resp.ok) throw new Error(`Failed to remove role: ${resp.status}`)
}

export async function syncClubMemberRole(input: {
  userId: string
  coveredThroughYear: number
  source: string
}): Promise<RoleSyncResult> {
  const userId = String(input.userId || '').trim()
  if (!userId) return { status: 'skipped', reason: 'missing_user' }

  const settingsDoc = await adminDb.collection('system_settings').doc('global').get()
  const membership = (settingsDoc.exists ? (settingsDoc.data() as any)?.membership : null) || {}
  const clubMemberRoleId = typeof membership?.clubMemberRoleId === 'string' ? membership.clubMemberRoleId : ''
  if (!clubMemberRoleId) return { status: 'skipped', reason: 'missing_club_member_role_id' }

  const guildId = String(process.env.DISCORD_GUILD_ID || '').trim()
  const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim()
  if (!guildId || !botToken) return { status: 'skipped', reason: 'missing_discord_env' }

  const shouldHaveRole = Number(input.coveredThroughYear) >= new Date().getUTCFullYear()
  try {
    if (shouldHaveRole) {
      await discordAddRole(guildId, userId, clubMemberRoleId, botToken)
    } else {
      await discordRemoveRole(guildId, userId, clubMemberRoleId, botToken)
    }
    return { status: 'succeeded', roleId: clubMemberRoleId }
  } catch {
    const queued = await adminDb.collection('role_updates').add({
      userId,
      guildId,
      addRoleIds: shouldHaveRole ? [clubMemberRoleId] : [],
      removeRoleIds: shouldHaveRole ? [] : [clubMemberRoleId],
      createdAt: new Date().toISOString(),
      attempt: 0,
      source: input.source,
    })
    return { status: 'queued', roleId: clubMemberRoleId, roleUpdateId: queued.id }
  }
}

function loginRoleId(): string {
  return String(process.env.DISCORD_REQUIRED_ROLE_ID || VERIFIED_MEMBER_ROLE_ID || '').trim()
}

async function getVerificationFacts(
  guildId: string,
  userId: string,
  botToken: string,
  criteria: VerificationCriteria,
): Promise<VerificationFacts> {
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Discord member lookup failed: ${response.status}`)
  const member = await response.json()
  if (!Array.isArray(member.roles)) throw new Error('Discord member response has no roles')

  // Use the same read order as the bot: Discord state, then the saved verification data.
  const userDoc = criteria.requiresZwiftId ? await adminDb.collection('users').doc(userId).get() : null
  return {
    roleIds: member.roles,
    accountCreatedAt: Number(BigInt(userId) >> BigInt(22)) + 1420070400000,
    isServerBooster: member.premium_since != null,
    zwiftId: userDoc?.data()?.zwiftId,
  }
}

export async function syncMemberRoleOnLogin(input: {
  userId: string
  source: string
}): Promise<RoleSyncResult> {
  const userId = String(input.userId || '').trim()
  if (!userId) return { status: 'skipped', reason: 'missing_user' }

  const settingsDoc = await adminDb.collection('system_settings').doc('global').get()
  const membership = (settingsDoc.exists ? (settingsDoc.data() as any)?.membership : null) || {}
  const memberRoleIdFromSettings = typeof membership?.memberRoleId === 'string' ? membership.memberRoleId : ''
  const requiredRoleId = loginRoleId()
  const roleIds = Array.from(new Set(
    [requiredRoleId, String(memberRoleIdFromSettings || '').trim()].filter(Boolean)
  ))
  if (!roleIds.length) return { status: 'skipped', reason: 'missing_member_role_id' }

  const guildId = String(process.env.DISCORD_GUILD_ID || '').trim()
  const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim()
  if (!guildId || !botToken) return { status: 'skipped', reason: 'missing_discord_env' }

  // Without the settings we cannot know whether an additional target is the verified role.
  // Skip this sync safely; payment and onboarding must still be able to complete.
  let verificationSettings
  try {
    const doc = await adminDb.collection('verificationSettings').doc(guildId).get()
    verificationSettings = doc.data()
  } catch (error) {
    console.error(`[verification] user=${userId} source=${input.source} settings lookup failed`, error)
    return { status: 'skipped', reason: 'verification_unavailable' }
  }

  const failed: string[] = []
  let skippedReason: string | undefined
  for (const roleId of roleIds) {
    const configuredVerification = verificationSettings?.enabled && verificationSettings.verifiedRoleId === roleId
    const isLoginRole = roleId === requiredRoleId || roleId === VERIFIED_MEMBER_ROLE_ID
    if (configuredVerification || isLoginRole) {
      const criteria = configuredVerification
        ? { ...DEFAULT_VERIFICATION_CRITERIA, ...verificationSettings?.criteria }
        : DEFAULT_VERIFICATION_CRITERIA
      try {
        const facts = await getVerificationFacts(guildId, userId, botToken, criteria)
        if (facts.roleIds.includes(roleId)) continue
        const result = evaluateVerificationCriteria(criteria, facts)
        if (!result.meetsAllCriteria) {
          skippedReason = 'verification_requirements_not_met'
          continue
        }
      } catch (error) {
        skippedReason = 'verification_unavailable'
        console.error(`[verification] user=${userId} role=${roleId} source=${input.source} lookup failed`, error)
        continue
      }
    }

    try {
      await discordAddRole(guildId, userId, roleId, botToken)
    } catch {
      failed.push(roleId)
    }
  }

  const primaryRoleId = requiredRoleId || roleIds[0]
  if (!failed.length) {
    return skippedReason
      ? { status: 'skipped', reason: skippedReason }
      : { status: 'succeeded', roleId: primaryRoleId }
  }

  const queued = await adminDb.collection('role_updates').add({
    userId,
    guildId,
    addRoleIds: failed,
    removeRoleIds: [],
    createdAt: new Date().toISOString(),
    attempt: 0,
    source: input.source,
  })
  return { status: 'queued', roleId: primaryRoleId, roleUpdateId: queued.id }
}

/** Sync eligible login roles, and the club role when membership is already paid. */
export async function syncAccessRoles(userId: string, source: string): Promise<void> {
  const id = String(userId || '').trim()
  if (!id) return

  await syncMemberRoleOnLogin({ userId: id, source })

  const membershipSnap = await adminDb.collection('memberships').doc(id).get()
  const membership = membershipSnap.exists ? (membershipSnap.data() as any) : {}
  const coveredThroughYear = typeof membership?.coveredThroughYear === 'number' ? membership.coveredThroughYear : null
  const paid =
    String(membership?.currentStatus || '') === 'club' &&
    coveredThroughYear !== null &&
    coveredThroughYear >= new Date().getUTCFullYear()
  if (!paid || coveredThroughYear === null) return

  await syncClubMemberRole({
    userId: id,
    coveredThroughYear,
    source,
  })
}
