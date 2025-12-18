import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

export async function POST(request: Request) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requesterDiscordId = String((token as any)?.discordId || '');
    const roles = (token as any)?.roles as string[] | undefined;
    const teamCaptainRoleId = '1195878349617250405';
    if (!Array.isArray(roles) || !roles.includes(teamCaptainRoleId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { roleId, zwiftId, reason } = await request.json();
    if (!roleId || !zwiftId) {
      return NextResponse.json({ error: 'Missing roleId or zwiftId' }, { status: 400 });
    }

    // Confirm requester is the team captain for the specified roleId
    const explicitDoc = await adminDb.collection('selfRoles').doc('1195850595014299669').get();
    let selfRolesDoc: any | null = null;
    if (explicitDoc.exists) {
      selfRolesDoc = explicitDoc.data();
    } else {
      const selfRolesSnap = await adminDb.collection('selfRoles').limit(1).get();
      if (!selfRolesSnap.empty) selfRolesDoc = selfRolesSnap.docs[0].data();
    }
    if (!selfRolesDoc) return NextResponse.json({ error: 'Role configuration not found' }, { status: 500 });

    const panels = selfRolesDoc?.panels || {};
    let isCaptain = false;
    for (const panel of Object.values<any>(panels)) {
      const rolesArr: any[] = Array.isArray(panel?.roles) ? panel.roles : Object.values(panel?.roles || {});
      if (Array.isArray(rolesArr)) {
        const match = rolesArr.find(r => String(r?.roleId ?? r?.id) === String(roleId));
        if (match && String(match.teamCaptainId || '') === requesterDiscordId) {
          isCaptain = true;
          break;
        }
      }
    }
    if (!isCaptain) {
      return NextResponse.json({ error: 'Only the team captain for this role can add members.' }, { status: 403 });
    }

    // Lookup Discord ID from zwiftId
    const usersSnap = await adminDb.collection('users').where('zwiftId', '==', String(zwiftId)).limit(1).get();
    const discordId = usersSnap.empty ? null : String((usersSnap.docs[0].data() as any)?.discordId || usersSnap.docs[0].id);
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord user linked to this ZwiftID' }, { status: 404 });
    }

    // Call Discord API to add the role to the user
    const guildId = process.env.DISCORD_GUILD_ID as string;
    const botToken = process.env.DISCORD_BOT_TOKEN as string;
    if (!guildId || !botToken) {
      return NextResponse.json({ error: 'Missing Discord env (DISCORD_GUILD_ID or DISCORD_BOT_TOKEN)' }, { status: 500 });
    }

    const addUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(discordId)}/roles/${encodeURIComponent(roleId)}`;
    const resp = await fetch(addUrl, { method: 'PUT', headers: { Authorization: `Bot ${botToken}` } });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `Discord API error (${resp.status}): ${text}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to add member' }, { status: 500 });
  }
}


