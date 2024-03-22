import axios from 'axios';
import { racePosts } from "../racePosts";



export async function POST(req: Request) {
  const raceSeries = req.headers.get('raceseries');
  const Races = racePosts().slice(-5)
  const race = Races.filter(race => race.raceSeries === raceSeries).slice(-1)[0];
  const imageUrl1 =`https://www.dzrracingseries.com/${race.raceSeries.toLowerCase().replace(/\s+/g, '-')}/${race.route.toLowerCase().replace(/\s+/g, '-')}/${race.route.split(' ').join('-')}-profile.png`
  const imageUrl2 =`https://www.dzrracingseries.com/${race.raceSeries.toLowerCase().replace(/\s+/g, '-')}/${race.route.toLowerCase().replace(/\s+/g, '-')}/${race.route.split(' ').join('-')}-finish.png`
  

let message;
let webhookUrl;
    if (raceSeries === 'DZR After Party') {
      webhookUrl = process.env.DISCORD_WEB_HOOK_DZR_AFTER_PARTY;
      message = `**Race Details for ${race.date}** \n **World:** ${race.world} \n **Route:** [${race.route}](${race.linkRoute}) \n **Laps:** ${race.laps} \n **Distance:** ${race.distance} km \n **Elevation:** ${race.elevation} hm \n **Race Pass:** [Zwift](https://www.zwift.com/eu/events/view/${race.raceID}) \n **More information on:** [www.dzrracingseries.com/dzr-after-party](https://www.dzrracingseries.com/${race.raceSeries.toLowerCase().replace(/\s+/g, '-')}/)`;
      } else if (raceSeries === 'The Zwifty Fifty') {
      webhookUrl = process.env.DISCORD_WEB_HOOK_THE_ZWIFTY_FIFTY;
      message = `**Race Details for ${race.date}** \n **World:** ${race.world} \n **Route:** [${race.route}](${race.linkRoute}) \n **Laps:** ${race.laps} \n **Distance:** ${race.distance} km \n **Elevation:** ${race.elevation} hm \n **Sprints:** ${race.sprints.join(', ')} \n **Bonus Seconds:** ${race.bonus.join('s, ')}s\n **Race Pass:** [Zwift](https://www.zwift.com/eu/events/view/${race.raceID}) \n **More information on:** [www.dzrracingseries.com/the-zwifty-fifty](https://www.dzrracingseries.com/${race.raceSeries.toLowerCase().replace(/\s+/g, '-')}/)`;
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