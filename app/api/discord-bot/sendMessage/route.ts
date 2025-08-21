// app/api/discord-bot/sendMessage/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';

type SendMessageBody = {
  channelId: string;
  messageContent: string;
  userIds?: string[];
  roleIds?: string[];
  mentionEveryone?: boolean;
};

export async function POST(request: Request) {
  const botToken = process.env.DISCORD_BOT_TOKEN; // Ensure your bot token is stored in environment variables

  const { channelId, messageContent, userIds, roleIds, mentionEveryone } = (await request.json()) as SendMessageBody;

  if (!channelId || !messageContent) {
    return NextResponse.json(
      { success: false, error: 'Channel ID and message content are required.' },
      { status: 400 }
    );
  }

  try {
    const payload: any = {
      content: messageContent,
      allowed_mentions: {
        parse: [] as string[],
        users: Array.isArray(userIds) ? userIds : [],
        roles: Array.isArray(roleIds) ? roleIds : [],
        replied_user: false,
      },
    };

    if (mentionEveryone) {
      payload.allowed_mentions.parse.push('everyone');
    }

    const response = await axios.post(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
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
