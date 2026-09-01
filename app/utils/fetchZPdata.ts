// app/utils/fetchZPdata.ts

export interface RiderData {
    race: {
      current: {
        rating: number;
      };
      max30: {
        rating: number;
      }
      max90: {
        rating: number;
      }
    };
    phenotype: {
      value: string;
    };
    // ... include other relevant fields
  }

  /** Example of a minimal ClubData interface */
export interface ClubData {
  clubId: number;
  name: string;
  riders: ClubRiderData[];  // <-- Must include 'riders' array
}

/** Example Rider type (very partial / simplified) */
export interface ClubRiderData {
  riderId: number;
  name: string;
  gender?: string;
  country?: string;
  age?: string;
  height?: number;
  weight?: number;
  zpCategory?: string;
  zpFTP?: number;
  power?: PowerData;
  race?: RaceData;
  handicaps?: HandicapsData;
  phenotype?: PhenotypeData;
  racingScore?: number;
  zrs?: ZrsData;
}

/** Partial definitions for sub-objects */
export interface PowerData {
  wkg5?: number;
  wkg15?: number;
  wkg30?: number;
  // etc...
  CP?: number;
  AWC?: number;
  // ...
}

export interface RaceData {
  last?: RaceDetail;
  current?: RaceDetail;
  max30?: RaceDetail;
  max90?: RaceDetail;
  finishes?: number;
  dnfs?: number;
  wins?: number;
  podiums?: number;
  // ...
}

export interface RaceDetail {
  rating?: number;
  date?: number;
  mixed?: {
    category?: string;
    number?: number;
  };
  // ...
}

export interface HandicapsData {
  profile?: {
    flat?: number;
    rolling?: number;
    hilly?: number;
    mountainous?: number;
  };
}

export interface PhenotypeData {
  scores?: {
    sprinter?: number;
    puncheur?: number;
    pursuiter?: number;
    climber?: number;
    tt?: number;
  };
  value?: string;
  bias?: number;
}

export interface ZrsData {
  score?: number;
  eventId?: string;
  eventTime?: number;
}

/** ZRS from ZwiftRacing (`zrs.score`) or the older Zwift-profile overlay (`racingScore`). */
export function getRacingScore(rider: any): number | null {
  if (typeof rider?.racingScore === 'number' && Number.isFinite(rider.racingScore)) {
    return rider.racingScore;
  }
  const zrsScore = rider?.zrs?.score;
  if (typeof zrsScore === 'number' && Number.isFinite(zrsScore)) {
    return zrsScore;
  }
  return null;
}

function withRacingScoreFromZrs<T extends Record<string, any>>(rider: T): T {
  const score = getRacingScore(rider);
  if (score === null || rider.racingScore === score) return rider;
  return { ...rider, racingScore: score };
}

  
export async function fetchRiderdata(id: string): Promise<RiderData | null> {
    const authKey = process.env.ZR_AUTH_KEY;
    if (!authKey) {
      console.error('Missing ZR_AUTH_KEY in environment variables');
      return null;
    }
  
    try {
      const response = await fetch(`https://api.zwiftracing.app/api/public/riders/${id}`, {
        headers: {
          Authorization: authKey,
        },
        cache: 'no-store',
        next: { revalidate: 0 },
      });
  
      if (!response.ok) {
        console.error(`Unable to fetch data for ID=${id}. Status: ${response.status}`);
        return null;
      }
  
      const data = await response.json();
      return withRacingScoreFromZrs(data) as RiderData;
    } catch (error) {
      console.error(`Error fetching data for ID=${id}:`, error);
      return null;
    }
}

  export interface ClubData {
    race: {
      current: {
        rating: number;
      };
      max30: {
        rating: number;
      }
      max90: {
        rating: number;
      }
    };
    phenotype: {
      value: string;
    };
    // ... include other relevant fields
  }

  export async function fetchClubdata(club: string): Promise<ClubData | null> {
    const authKey = process.env.ZR_AUTH_KEY;
    if (!authKey) {
      console.error('Missing ZR_AUTH_KEY in environment variables');
      return null;
    }
  
    try {
      const response = await fetch(`https://api.zwiftracing.app/api/public/clubs/${club}`, {
        headers: {
          Authorization: authKey,
        },
        cache: 'no-store',
        next: { revalidate: 0 },
      });
  
      if (!response.ok) {
        console.error(`Unable to fetch data for ID=${club}. Status: ${response.status}`);
        return null;
      }
  
      const data = await response.json();
      if (data && Array.isArray(data.riders)) {
        data.riders = data.riders.map((rider: ClubRiderData) => withRacingScoreFromZrs(rider));
      }
      return data
    } catch (error) {
      console.error(`Error fetching data for ID=${club}:`, error);
      return null;
    }
}