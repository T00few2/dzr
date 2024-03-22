
import axios from 'axios';

export async function GET(req: Request, res: Response) {
  // Handle GET request
  return new Response('Hello')
}

export async function POST(req: Request, res: Response) {
  const webhookUrl = process.env.DISCORD_WEB_HOOK_DZR_AFTER_PARTY//'https://discord.com/api/webhooks/1220454320777072721/WUKlYyFtiTRgJvOBM3e3l7uU3hX4XBNiylzNgKrSfu2SPOWWUwdPOebeLmoWGyC1hA78'
  if (!webhookUrl) {
    throw new Error('WEBHOOK_URL is not defined');
  }
  const message = 'Todays profile!'
  const imageUrl ='https://dzrracingseries.com/dzr-after-party/libby-hill-after-party+/Libby-Hill-After-Party+-profile.png'
  
  try {
      await axios.post(webhookUrl, {
          content: message,
          embeds: [
              {
                  image: {
                      url: imageUrl
                  }
              }
          ]
      });
      return new Response('Discord message sent');
      
  } catch (error) {

    return new Response('Error sending Discord message');      
  }
}