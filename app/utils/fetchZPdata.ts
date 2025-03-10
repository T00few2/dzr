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

  
export async function fetchRiderdata(id: string): Promise<RiderData | null> {
    const authKey = process.env.ZR_AUTH_KEY;
    if (!authKey) {
      console.error('Missing ZR_AUTH_KEY in environment variables');
      return null;
    }
  
    try {
      const response = await fetch(`https://zwift-ranking.herokuapp.com/public/riders/${id}`, {
        headers: {
          Authorization: authKey,
        },
      });
  
      if (!response.ok) {
        console.error(`Unable to fetch data for ID=${id}. Status: ${response.status}`);
        return null;
      }
  
      const data = await response.json();
      return data as RiderData;
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
      const response = await fetch(`https://zwift-ranking.herokuapp.com/public/clubs/${club}`, {
        headers: {
          Authorization: authKey,
        },
      });
  
      if (!response.ok) {
        console.error(`Unable to fetch data for ID=${club}. Status: ${response.status}`);
        return null;
      }
  
      const data = await response.json();
      return data
    } catch (error) {
      console.error(`Error fetching data for ID=${club}:`, error);
      return null;
    }
}