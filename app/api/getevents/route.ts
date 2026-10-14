import { NextResponse } from 'next/server';
import { loadUpcomingDzrEvents } from '@/app/lib/zwiftPublicEvents';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventName = searchParams.get("eventName");
  const channelId = searchParams.get("channelId");
  
  if (!eventName) {
    return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
  }

  if (!channelId) {
    return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
  }

  try {
    const events = await loadUpcomingDzrEvents();
    const matchedEvent = events.find((event) => event.name.toLowerCase() === eventName.toLowerCase());

    if (!matchedEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const messageContent = `Link til næste ${matchedEvent.name}: ${matchedEvent.url}`;

    const responseBot = await fetch(`https://www.dzrracingseries.com/api/discord-bot/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelId, messageContent }),
    });

    if (!responseBot.ok) {
      return NextResponse.json({ error: 'Failed to send message to Discord' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Event link sent successfully', eventName: matchedEvent.name });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch events data' }, { status: 500 });
  }
}
