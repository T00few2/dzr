// app/api/discord-bot/sendMessage/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  const botToken = process.env.DISCORD_BOT_TOKEN; // Ensure your bot token is stored in environment variables

  // Parse the request body to get channelId and messageContent
  const { channelId, messageContent } = await request.json();

  if (!channelId || !messageContent) {
    return NextResponse.json(
      { success: false, error: 'Channel ID and message content are required.' },
      { status: 400 }
    );
  }

  try {
    const response = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      { content: messageContent },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    return NextResponse.json({ success: true, message: response.data });
  } catch (error: any) { // Add typing for the error
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: error.response?.data || error.message },
      { status: 500 }
    );
  }
}
