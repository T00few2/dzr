import axios from 'axios';
import { fetchRaceCalendarData } from '../google/googleSheetsDataServer';
import { AfterPartyRacesData } from '@/app/dzr-after-party/AfterPartyRaces';
import { ZwiftyFiftyRacesData } from '@/app/the-zwifty-fifty/ZwiftyFiftyRaces';

import { apsInfo, zfInfo } from '../google/calendarTemplate';

export async function POST(req: Request) {
  const raceSeries = req.headers.get('raceseries');
  if (!raceSeries || (raceSeries !== 'DZR After Party' && raceSeries !== 'The Zwifty Fifty')) {
    return new Response('Invalid or missing race series', { status: 400 });
  }

  const calendarData = await fetchRaceCalendarData(raceSeries as 'DZR After Party' | 'The Zwifty Fifty');
  const nextRace = calendarData.filter(data => data.raceID !== '').slice(-1)[0]

  const imageUrl1 =`https://www.dzrracingseries.com/${raceSeries.toLowerCase().replace(/\s+/g, '-')}/${nextRace.route.toLowerCase().replace(/\s+/g, '-')}/${nextRace.route.split(' ').join('-')}-profile.png`

let message;
let webhookUrl;
    if (raceSeries === 'DZR After Party') {
      const afterPartyRaceData = AfterPartyRacesData.find(data => data.route === nextRace.route)
      
      if (afterPartyRaceData) {
        const race = apsInfo(nextRace, afterPartyRaceData) as { raceSeries: string; world: string; laps: string; distance: string; elevation: string; finish: string; linkRoute: string; climbs: string[]; sprints: string[]; sprintLaps: string[]; bonus: string[]; date: string; route: string; raceID: string; };
        message = `**Race Details for ${race.date}** \n **World:** ${race.world} \n **Route:** [${race.route}](${race.linkRoute}) \n **Laps:** ${race.laps} \n **Distance:** ${race.distance} km \n **Elevation:** ${race.elevation} hm \n **Race Pass:** [Zwift](https://www.zwift.com/eu/events/view/${race.raceID}) \n **More information on:** [www.dzrracingseries.com/dzr-after-party](https://www.dzrracingseries.com/${race.raceSeries.toLowerCase().replace(/\s+/g, '-')}/)`;
      }
      webhookUrl = process.env.DISCORD_WEB_HOOK_DZR_AFTER_PARTY;
      //message = `**Race Details for ${race.date}** \n **World:** ${race.world} \n **Route:** [${race.route}](${race.linkRoute}) \n **Laps:** ${race.laps} \n **Distance:** ${race.distance} km \n **Elevation:** ${race.elevation} hm \n **Race Pass:** [Zwift](https://www.zwift.com/eu/events/view/${race.raceID}) \n **More information on:** [www.dzrracingseries.com/dzr-after-party](https://www.dzrracingseries.com/${race.raceSeries.toLowerCase().replace(/\s+/g, '-')}/)`;
    } else if (raceSeries === 'The Zwifty Fifty') {
        const zwiftyFiftyRaceData = ZwiftyFiftyRacesData.find(data => data.route === nextRace.route)
        if (zwiftyFiftyRaceData) {
        const race = zfInfo(nextRace, zwiftyFiftyRaceData) as { raceSeries: string; world: string; laps: string; distance: string; elevation: string; finish: string; linkRoute: string; climbs: string[]; sprints: string[]; sprintLaps: string[]; bonus: string[]; date: string; route: string; raceID: string; };
        webhookUrl = process.env.DISCORD_WEB_HOOK_THE_ZWIFTY_FIFTY;
        message = `**Race Details for ${race.date}** \n **World:** ${race.world} \n **Route:** [${race.route}](${race.linkRoute}) \n **Laps:** ${race.laps} \n **Distance:** ${race.distance} km \n **Elevation:** ${race.elevation} hm \n **Sprints:** ${race.sprints.join(', ')} \n **Bonus Seconds:** ${race.bonus.join('s, ')}s\n **Race Pass:** [Zwift](https://www.zwift.com/eu/events/view/${race.raceID}) \n **More information on:** [www.dzrracingseries.com/the-zwifty-fifty](https://www.dzrracingseries.com/${race.raceSeries.toLowerCase().replace(/\s+/g, '-')}/)`;
        }
    } else {
        throw new Error('Invalid race series');
    }
if (!webhookUrl) {
    throw new Error('WEBHOOK_URL is not defined');
    }

try {  
  await axios.post(webhookUrl, {
    content: message,
    embeds: [
      {
        image: {
          url: imageUrl1
        },
        fields: [
          {
            name: 'Route Profile',
            value: ''
          }
        ]
      },
    ]
  });

      const responseMessage = `Discord message sent to: ${raceSeries}`;
      return new Response(responseMessage);
      
  } catch (error) {

    return new Response(`Error sending Discord message to: ${raceSeries}`);      
  }
}