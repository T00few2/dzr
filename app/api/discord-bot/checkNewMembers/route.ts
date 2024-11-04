// app/api/discord-bot/checkNewMembers/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = '1196470145493774446';
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || !channelId || !guildId) {
    return NextResponse.json(
      { success: false, error: 'Bot token, channel ID, and guild ID must be set in environment variables.' },
      { status: 500 }
    );
  }

  try {
    // Calculate the date range: previous Monday to the day before this Monday (Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - dayOfWeek - 6);  // Previous Monday
    lastMonday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);
    lastSunday.setHours(23, 59, 59, 999);

    // Fetch all guild members
    const { data: members } = await axios.get(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    // Filter members who joined within the last week's date range
    const newMembers = members.filter((member: any) => {
      const joinedAt = new Date(member.joined_at);
      return joinedAt >= lastMonday && joinedAt <= lastSunday;
    });

    if (newMembers.length > 0) {
      // Format the welcome message with mentions for each new member
      const memberMentions = newMembers.map((member: any) => `<@${member.user.id}>`).join(', ');
      const messageContent = `A very warm welcome to our new members who joined last week 🎉🎉\n ${memberMentions}!`;

      const response = await fetch(`/api/discord-bot/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelId, messageContent }),
      });
  
      const data = await response.json();

      return NextResponse.json({ success: true, message: 'Message sent!' });
    } else {
      return NextResponse.json({ success: true, message: 'No new members last week.' });
    }
  } catch (error: any) {
    console.error('Error fetching members or sending message:', error);
    return NextResponse.json(
      { success: false, error: error.response?.data || error.message },
      { status: 500 }
    );
  }
}
