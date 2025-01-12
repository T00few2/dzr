// app/api/discord-bot/zrlUpdate/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig'; // Use Admin SDK
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';

type Rider = {
  id: string;
  name: string;
  division: string;
  rideTime: string;
};

type Team = {
  id: string;
  name: string;
  captainName: string;
  rideTime: string;
  division: string;
  lookingForRiders: boolean;
};

export async function POST(request: Request) {
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

    // Fetch teams looking for riders
    const teamsSnapshot = await adminDb.collection('teams').where('lookingForRiders', '==', true).get();
    const teams: Team[] = teamsSnapshot.docs.map((doc: QueryDocumentSnapshot): Team => ({
      id: doc.id,
      ...(doc.data() as Omit<Team, 'id'>),
    }));

    let messageContent = '';
    if (riders.length > 0 || teams.length > 0) {
      messageContent += "**🚨 Opsamling 🚨**\n\n"
    }
    // Add riders section if there are riders
    if (riders.length > 0) {
      messageContent += `🚴 **Ryttere der leder efter hold** 🚴\n\n${riders
        .map(
          (rider: Rider) =>
            `**${rider.name}**\n- Division: ${rider.division}\n- Preferred Time: ${rider.rideTime}`
        )
        .join('\n\n')}`;
    }

    // Add teams section if there are teams looking for riders
    if (teams.length > 0) {
      if (messageContent) messageContent += `\n\n`; // Add separator if riders were listed
      messageContent += `📢 **Hold der leder efter ryttere** 📢\n\n${teams
        .map(
          (team: Team) =>
            `**${team.name}**\n- Division: ${team.division}\n- Ride Time: ${team.rideTime}\n- Captain: ${team.captainName}`
        )
        .join('\n\n')}`;
    }

    if (messageContent) messageContent +='\n\n Hvis du eller dit hold er eller ikke er på listen og status er ændret, må du meget gerne opdatere status på websiden 🫶'
 
    // If there's nothing to send, respond with no updates
    if (!messageContent) {
      return NextResponse.json({ success: true, message: 'No updates to send.' });
    }

    // Send the message to Discord
    const response = await fetch(
      `https://www.dzrracingseries.com/api/discord-bot/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelId, messageContent }),
      }
    );

    if (response.ok) {
      return NextResponse.json({ success: true, message: 'Updates sent to Discord successfully!' });
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
