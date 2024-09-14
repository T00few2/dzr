// app/api/getevents/route.ts

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

type Event = {
  id: number;
  name: string;
  eventStart: string;
};

export async function GET() {
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

    // Define the path to save the file
    const filePath = path.join(process.cwd(), 'app', 'api', 'getevents', 'events.json');

    // Write the data to the file
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2));

    return NextResponse.json({ message: 'Events data saved successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch or save events data' }, { status: 500 });
  }
}
