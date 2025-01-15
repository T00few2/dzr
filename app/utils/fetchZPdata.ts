// app/utils/fetchZPdata.ts

export interface RaceData {
    race: {
      current: {
        rating: number;
      };
    };
    phenotype: {
      value: string;
    };
    // ... include other relevant fields
  }
  
  export async function fetchZPdata(id: string): Promise<RaceData | null> {
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
      return data as RaceData;
    } catch (error) {
      console.error(`Error fetching data for ID=${id}:`, error);
      return null;
    }
  }
  