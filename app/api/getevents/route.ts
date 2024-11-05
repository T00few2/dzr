import axios from 'axios';
import { NextResponse } from 'next/server';

type Event = {
  id: number;
  name: string;
  eventStart: string;
};

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

  const url = "https://us-or-rly101.zwift.com/api/public/events/upcoming?limit=200&tags=dzr";

  try {
    const response = await axios.get(url);
    const data = response.data;

    // Extract event details
    const events: Event[] = data.map((event: any) => ({
      id: event.id,
      name: event.name,
      eventStart: event.eventStart,
    }));

    // Find the event with the matching name
    const matchedEvent = events.find(event => event.name.toLowerCase() === eventName.toLowerCase());

    if (!matchedEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const messageContent = `Link til næste ${matchedEvent.name}: https://www.zwift.com/events/view/${matchedEvent.id}`;

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
