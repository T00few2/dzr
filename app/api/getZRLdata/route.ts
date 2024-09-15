import { NextResponse } from 'next/server';

// Define the type for divisionIdList
type DivisionIdList = { [key: string]: string };

export async function GET() {
  // Load division IDs from the JSON file
  const divisionFilePath = 'division_ids.json';

  const divisionIdList: DivisionIdList = await fetch(`/${divisionFilePath}`).then(response => response.json());

  const fetchData = async (season: number, race: number, division: string) => {
    const url = `https://www.wtrl.racing/wtrl_api/json/cache.php?competition=zrl&type=results&season=${season}&race=${race}&division=${division}`;
    
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
      "Authorization": "Bearer ZWYzM2RjYTcwZjg3YTA3MzgzM2MzMTU1NzM3YWY2M2Y=", 
      "Cookie": "wtrl_sid=ef33dca70f87a073833c3155737af63f; wtrl_ouid=eyJpYXQiOjE3MjYzNDk1OTMsImVhdCI6MTcyNjQzNTk5MywicHJvZmlsZV9waWMiOiJodHRwczpcL1wvc3RhdGljLWNkbi56d2lmdC5jb21cL3Byb2RcL3Byb2ZpbGVcLzJkMWM4MTAyLTM4MTA2MSIsImZpcnN0X25hbWUiOiJDaHJpc3RpYW4iLCJsYXN0X25hbWUiOiJLalx1MDBlNnIiLCJlbWFpbCI6ImNocmlzdGlhbi5ramFyQGdtYWlsLmNvbSIsInVzZXJDbGFzcyI6IjEiLCJ6d2lmdElkIjoiMTU2OTAiLCJ1c2VySWQiOiIzNjk1NCIsImNvdW50cnlfaWQiOiIyMDgiLCJnZW5kZXIiOiJNYWxlIiwicmFjZVRlYW0iOiIwIn0%3D.ef33dca70f87a073833c3155737af63f",
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.statusText}`);
    }

    return response.json();
  };

  try {
    const data: any[] = [];

    for (const division of Object.values(divisionIdList)) {
      try {
        const result = await fetchData(14, 1, division as string); // Type assertion here
        data.push(...result.data);
      } catch (error) {
        console.error(`Error fetching data for division ${division}:`, error);
      }
    }

    return NextResponse.json(data);

  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: `Something went wrong: ${error.message}` }, { status: 500 });
    } else {
      return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
    }
  }
}
