export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

type RoleDef = { roleId: string; roleName?: string; teamCaptainId?: string | boolean | null };

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
        .map((r: any) => ({ roleId: String(r?.roleId ?? r?.id ?? ''), roleName: r?.roleName ?? r?.name, teamCaptainId: r?.teamCaptainId }))
        .filter((r: RoleDef) => r.roleId);
    } else if (rolesNode && typeof rolesNode === 'object') {
      roleDefs = Object.values(rolesNode)
        .filter((r: any) => r && (r.roleId || r.id))
        .map((r: any) => ({ roleId: String(r.roleId ?? r.id), roleName: r.roleName ?? r.name, teamCaptainId: r.teamCaptainId }));
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
      return { roleId: r.roleId, roleName: r.roleName ?? r.roleId, zwiftIds };
    });

    return NextResponse.json({ roles: out });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load captain roles' }, { status: 500 });
  }
}


