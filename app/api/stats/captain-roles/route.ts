export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

type RoleDef = { roleId: string; roleName?: string; teamCaptainId?: string | boolean | null; raw?: any };

async function fetchAllGuildMembers(guildId: string, botToken: string) {
  const members: any[] = [];
  let after: string | undefined = undefined;
  // Discord API paginates by 'after' user id
  for (let i = 0; i < 50; i++) {
    const url = new URL(`https://discord.com/api/v10/guilds/${guildId}/members`);
    url.searchParams.set('limit', '1000');
    if (after) url.searchParams.set('after', after);
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bot ${botToken}` },
      cache: 'no-store',
    });
    if (!resp.ok) break;
    const page = (await resp.json()) as any[];
    members.push(...page);
    if (page.length < 1000) break;
    after = page[page.length - 1]?.user?.id;
    if (!after) break;
  }
  return members;
}

export async function GET() {
  try {
    const guildId = process.env.DISCORD_GUILD_ID as string;
    const botToken = process.env.DISCORD_BOT_TOKEN as string;
    if (!guildId || !botToken) {
      return NextResponse.json({ error: 'Missing Discord env (DISCORD_GUILD_ID or DISCORD_BOT_TOKEN)' }, { status: 500 });
    }

    // 1) Read roles from selfRoles specific document with nested path panels -> dzr -> roles
    // Document id provided by user: 1195850595014299669
    const explicitDoc = await adminDb.collection('selfRoles').doc('1195850595014299669').get();
    let selfRolesDoc: any | null = null;
    if (explicitDoc.exists) {
      selfRolesDoc = explicitDoc.data();
    } else {
      const selfRolesSnap = await adminDb.collection('selfRoles').limit(1).get();
      if (!selfRolesSnap.empty) selfRolesDoc = selfRolesSnap.docs[0].data();
    }
    if (!selfRolesDoc) return NextResponse.json({ roles: [] });

    // Expected structure: panels -> dzr -> roles -> { [roleNumber]: { roleId, roleName, teamCaptainId } }
    const rolesNode = selfRolesDoc?.panels?.dzr?.roles;
    let roleDefs: RoleDef[] = [];
    if (Array.isArray(rolesNode)) {
      roleDefs = rolesNode
        .map((r: any) => ({ roleId: String(r?.roleId ?? r?.id ?? ''), roleName: r?.roleName ?? r?.name, teamCaptainId: r?.teamCaptainId, raw: r }))
        .filter((r: RoleDef) => r.roleId);
    } else if (rolesNode && typeof rolesNode === 'object') {
      roleDefs = Object.values(rolesNode)
        .filter((r: any) => r && (r.roleId || r.id))
        .map((r: any) => ({ roleId: String(r.roleId ?? r.id), roleName: r.roleName ?? r.name, teamCaptainId: r.teamCaptainId, raw: r }));
    }

    const captainRoles = roleDefs.filter((r) => r.teamCaptainId);
    const roleIdSet = new Set(captainRoles.map(r => r.roleId));

    // 2) Fetch all guild members and collect discordIds per roleId of interest
    const members = await fetchAllGuildMembers(guildId, botToken);
    const roleIdToDiscordIds = new Map<string, Set<string>>();
    captainRoles.forEach(r => roleIdToDiscordIds.set(r.roleId, new Set<string>()));
    for (const m of members) {
      const userId = String(m?.user?.id || '');
      const roles: string[] = Array.isArray(m?.roles) ? m.roles.map((x: any) => String(x)) : [];
      roles.forEach((rid) => {
        if (roleIdSet.has(rid)) {
          roleIdToDiscordIds.get(rid)?.add(userId);
        }
      });
    }

    // 3) Build discordId -> zwiftID map from discord_users
    const duSnap = await adminDb.collection('discord_users').get();
    const discordToZwift = new Map<string, string>();
    duSnap.forEach((d) => {
      const data = d.data() as any;
      const did = String(data?.discordID ?? d.id);
      const zw = data?.zwiftID != null ? String(data.zwiftID) : '';
      if (did && zw) discordToZwift.set(did, zw);
    });

    // 4) Produce response roles with zwiftIds
    const out = captainRoles.map((r) => {
      const dids = Array.from(roleIdToDiscordIds.get(r.roleId) || []);
      const zwiftIds = dids.map((id) => discordToZwift.get(id)).filter((x): x is string => Boolean(x));
      const raw = (r as any).raw || {};
      return {
        roleId: r.roleId,
        roleName: r.roleName ?? r.roleId,
        zwiftIds,
        // expose team metadata from backend-managed roles
        isTeamRole: !!raw.isTeamRole,
        teamName: raw.teamName ?? r.roleName ?? r.roleId,
        raceSeries: raw.raceSeries ?? null,
        division: raw.division ?? null,
        rideTime: raw.rideTime ?? null,
        lookingForRiders: !!raw.lookingForRiders,
        sortIndex: typeof raw.sortIndex === 'number' ? raw.sortIndex : 0,
        visibility: raw.visibility ?? 'public',
        teamCaptainId: r.teamCaptainId ?? null,
        captainDisplayName: raw.captainDisplayName ?? null,
      };
    });

    // 5) Build profiles for all guild members that have a linked ZwiftID
    const discordIdToProfile = new Map<string, { discordId: string; displayName: string; avatarUrl?: string }>();
    for (const m of members) {
      const user = m?.user || {};
      const discordId = String(user?.id || '');
      if (!discordId) continue;
      const username = String(user?.username || '');
      const globalName = String(user?.global_name || '');
      const nick = String(m?.nick || '');
      const displayName = nick || globalName || username || discordId;
      let avatarUrl: string | undefined = undefined;
      if (user?.id && user?.avatar) {
        const ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
        avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`;
      }
      discordIdToProfile.set(discordId, { discordId, displayName, avatarUrl });
    }

    const profiles = Array.from(discordToZwift.entries()).map(([discordId, zwiftId]) => {
      const p = discordIdToProfile.get(discordId);
      return { zwiftId, discordId, displayName: p?.displayName || '', avatarUrl: p?.avatarUrl };
    });

    // 6) Build membersByRole for captainRoles: include all members with that role (including those without linked ZwiftID)
    const membersByRole: Record<string, { discordId: string; displayName: string; avatarUrl?: string; zwiftId?: string }[]> = {};
    for (const r of captainRoles) {
      const dids = Array.from(roleIdToDiscordIds.get(r.roleId) || []);
      membersByRole[r.roleId] = dids.map((discordId) => {
        const profile = discordIdToProfile.get(discordId);
        const zw = discordToZwift.get(discordId);
        return { discordId, displayName: profile?.displayName || discordId, avatarUrl: profile?.avatarUrl, zwiftId: zw };
      });
    }

    return NextResponse.json({ roles: out, profiles, membersByRole });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load captain roles' }, { status: 500 });
  }
}


