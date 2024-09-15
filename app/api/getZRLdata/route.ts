import { NextResponse } from 'next/server';

export async function GET() {
  const url = "https://www.wtrl.racing/wtrl_api/json/cache.php?competition=zrl&type=results&season=14&race=1&division=0330C20&t=1726349709622&_1726349604310";

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "da,en-US;q=0.7,en;q=0.3",
    "Authorization": "Bearer ZWYzM2RjYTcwZjg3YTA3MzgzM2MzMTU1NzM3YWY2M2Y=",  // Replace with a valid token
    "Wtrl-Integrity": "5f09a678c27da4cd0600b04fd37b076a164abff80935d5eaedc05124b06fff34bba103",
    "wtrl-api-version": "2.7",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.wtrl.racing/zrl-results/?id=14",
    "Cookie": "wtrl_sid=ef33dca70f87a073833c3155737af63f; wtrl_ouid=eyJpYXQiOjE3MjYzNDk1OTMsImVhdCI6MTcyNjQzNTk5MywicHJvZmlsZV9waWMiOiJodHRwczpcL1wvc3RhdGljLWNkbi56d2lmdC5jb21cL3Byb2RcL3Byb2ZpbGVcLzJkMWM4MTAyLTM4MTA2MSIsImZpcnN0X25hbWUiOiJDaHJpc3RpYW4iLCJsYXN0X25hbWUiOiJLalx1MDBlNnIiLCJlbWFpbCI6ImNocmlzdGlhbi5ramFyQGdtYWlsLmNvbSIsInVzZXJDbGFzcyI6IjEiLCJ6d2lmdElkIjoiMTU2OTAiLCJ1c2VySWQiOiIzNjk1NCIsImNvdW50cnlfaWQiOiIyMDgiLCJnZW5kZXIiOiJNYWxlIiwicmFjZVRlYW0iOiIwIn0%3D.ef33dca70f87a073833c3155737af63f",
    "DNT": "1",
    "Sec-GPC": "1",
    "Connection": "keep-alive",
    "TE": "trailers"
  };

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return NextResponse.json({ error: `Error fetching data: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    // Check if the error is an instance of Error
    if (error instanceof Error) {
      return NextResponse.json({ error: `Something went wrong: ${error.message}` }, { status: 500 });
    } else {
      return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
    }
  }
}
