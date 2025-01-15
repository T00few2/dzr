// app/api/zr/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { fetchZPdata, RaceData } from '@/app/utils/fetchZPdata';

/**
 * Example: GET /api/zr/15690
 * Dynamically fetch rider data for the provided "id"
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { error: 'Missing rider ID' },
      { status: 400 }
    );
  }

  const raceData: RaceData | null = await fetchZPdata(id);

  if (!raceData) {
    return NextResponse.json(
      { error: 'Unable to fetch race data' },
      { status: 500 }
    );
  }

  return NextResponse.json(raceData, { status: 200 });
}
