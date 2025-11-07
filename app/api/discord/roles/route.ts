import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const guildId = process.env.DISCORD_GUILD_ID as string;
    const botToken = process.env.DISCORD_BOT_TOKEN as string;
    if (!guildId || !botToken) {
      return NextResponse.json({ error: 'Missing Discord env (DISCORD_GUILD_ID or DISCORD_BOT_TOKEN)' }, { status: 500 });
    }

    const resp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
      cache: 'no-store',
    });
    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: resp.status });
    }
    const roles = (await resp.json()) as Array<{ id: string; name: string } & Record<string, any>>;
    const out = roles.map(r => ({ id: String(r.id), name: String(r.name) }));
    return NextResponse.json({ roles: out }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lookup failed' }, { status: 500 });
  }
}


