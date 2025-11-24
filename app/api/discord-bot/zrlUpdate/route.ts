export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';

type Rider = {
  id: string;
  userId?: string;
  name: string;
  division: string;
  rideTime: string;
  raceSeries: string;
};

type Team = {
  id: string;
  name: string;
  raceSeries: string;
  rideTime: string;
  division: string;
  lookingForRiders: boolean;
  captainDiscordId?: string;
  captainName?: string;
};

function isAuthenticated(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  // Decode the Base64 username:password
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  // Validate against environment variables
  return (
    username === process.env.API_USERNAME &&
    password === process.env.API_PASSWORD
  );
}

export async function POST(request: Request) {
  // Authenticate request
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = '1297934562558611526';

  if (!botToken || !channelId) {
    return NextResponse.json(
      { success: false, error: 'Bot token and channel ID must be set in environment variables.' },
      { status: 500 }
    );
  }

  try {
    // Fetch all riders
    const ridersSnapshot = await adminDb.collection('riders').get();
    const riders: Rider[] = ridersSnapshot.docs.map((doc: QueryDocumentSnapshot): Rider => ({
      id: doc.id,
      ...(doc.data() as Omit<Rider, 'id'>),
    }));

    // Fetch teams looking for riders from backend-managed roles (selfRoles)
    const selfRolesSnap = await adminDb.collection('selfRoles').limit(1).get();
    let teams: Team[] = [];
    if (!selfRolesSnap.empty) {
      const selfRolesDoc = selfRolesSnap.docs[0].data() as any;
      const panels = selfRolesDoc?.panels || {};
      const teamRoles: any[] = [];
      Object.values(panels).forEach((panel: any) => {
        const roles = Array.isArray(panel?.roles) ? panel.roles : [];
        roles.forEach((role: any) => {
          if (role && role.isTeamRole && role.lookingForRiders) {
            teamRoles.push(role);
          }
        });
      });
      teams = teamRoles
        .map(
          (r: any): Team => ({
            id: String(r.roleId ?? r.id ?? ''),
            name: String(r.teamName ?? r.roleName ?? r.roleId ?? 'Unknown team'),
            raceSeries: String(r.raceSeries ?? ''),
            rideTime: String(r.rideTime ?? ''),
            division: String(r.division ?? ''),
            lookingForRiders: !!r.lookingForRiders,
            captainDiscordId: typeof r.teamCaptainId === 'string' ? r.teamCaptainId : undefined,
            captainName: r.captainDisplayName ? String(r.captainDisplayName) : undefined,
          })
        )
        .filter((t) => t.id);
    }

    // Resolve discordIds for mentions
    const mentionUserIds = new Set<string>();

    async function getDiscordIdForUid(uid?: string): Promise<string | null> {
      if (!uid) return null;
      try {
        const snap = await adminDb.collection('user_profiles').doc(uid).get();
        if (!snap.exists) return null;
        const data = snap.data() as any;
        const discordId = typeof data?.discordId === 'string' ? data.discordId : null;
        return discordId;
      } catch {
        return null;
      }
    }

    let messageContent = '';
    if (riders.length > 0 || teams.length > 0) {
      messageContent += '**🚨 Opsamling 🚨**\n\n';
    }
    if (riders.length > 0) {
      const riderLines = await Promise.all(
        riders.map(async (rider: Rider) => {
          const discordId = await getDiscordIdForUid(rider.userId);
          const riderDisplay = discordId ? `<@${discordId}>` : rider.name;
          if (discordId) mentionUserIds.add(discordId);
          return `**${riderDisplay}**\n- Race Series: ${rider.raceSeries}\n- Division: ${rider.division}\n- Preferred Time: ${rider.rideTime}`;
        })
      );
      messageContent += `🚴 **Ryttere der leder efter hold** 🚴\n\n${riderLines.join('\n\n')}`;
    }
    if (teams.length > 0) {
      if (messageContent) messageContent += `\n\n`;
      const teamLines = await Promise.all(
        teams.map(async (team: Team) => {
          const captainDiscordId = team.captainDiscordId;
          const captainDisplay = captainDiscordId ? `<@${captainDiscordId}>` : (team.captainName || 'Captain');
          if (captainDiscordId) mentionUserIds.add(captainDiscordId);
          return `**${team.name}**\n- Race Series: ${team.raceSeries}\n- Division: ${team.division}\n- Ride Time: ${team.rideTime}\n- Captain: ${captainDisplay}`;
        })
      );
      messageContent += `📢 **Hold der leder efter ryttere** 📢\n\n${teamLines.join('\n\n')}`;
    }
    if (messageContent) {
      messageContent +=
        '\n\n Hvis du eller dit hold er eller ikke er på listen og status er ændret, må du meget gerne opdatere status på websiden 🫶';
    }

    if (!messageContent) {
      return NextResponse.json({ success: true, message: 'No updates to send.' });
    }

    const response = await fetch(
      `https://www.dzrracingseries.com/api/discord-bot/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelId, messageContent, userIds: Array.from(mentionUserIds) }),
      }
    );

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Updates sent to Discord successfully!',
      });
    } else {
      const errorData = await response.json();
      return NextResponse.json(
        { success: false, error: errorData },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error('Error fetching updates or sending message:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error occurred.' },
      { status: 500 }
    );
  }
}
