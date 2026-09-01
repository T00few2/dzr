import constants from '../../packages/shared/constants.json'

export type SharedConstants = typeof constants

export const sharedConstants = constants as SharedConstants

export const ADMIN_ROLE_ID = sharedConstants.discord.roles.admin
export const VERIFIED_MEMBER_ROLE_ID = sharedConstants.discord.roles.verifiedMember
export const HOLDKAPTAJN_ROLE_ID = sharedConstants.discord.roles.holdkaptajn
export const COMMUNITY_MEMBER_ROLE_ID = sharedConstants.discord.roles.communityMember
export const KMS_ROLE_ID = sharedConstants.discord.roles.kms
export const DISCORD_GUILD_ID_DEFAULT = sharedConstants.discord.guildId
export const SITE_ORIGIN = sharedConstants.siteOrigin
export const COLLECTIONS = sharedConstants.firestore
