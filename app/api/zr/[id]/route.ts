// app/api/zr/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';

/**
 * Example: GET /api/zr/15690
 * Dynamically fetch rider data for the provided "id"
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Access your secret environment variable on the server
  const authKey = process.env.ZR_AUTH_KEY;
  if (!authKey) {
    // If you haven't set ZR_AUTH_KEY, respond with an error
    return NextResponse.json(
      { error: 'Missing ZR_AUTH_KEY in environment variables' },
      { status: 500 }
    );
  }

  try {
    // Fetch the rider data from the Zwift Ranking API
    const response = await fetch(
      `https://zwift-ranking.herokuapp.com/public/riders/${id}`,
      {
        headers: {
          Authorization: authKey,
        },
        // You can also specify other fetch options here, like method: 'GET'
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Unable to fetch data (status: ${response.status})` },
        { status: response.status }
      );
    }

    // Parse the JSON body from the Zwift Ranking API
    const data = await response.json();

    // Return the data as JSON to the client
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Error fetching rider data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
