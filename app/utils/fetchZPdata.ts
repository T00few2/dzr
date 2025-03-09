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