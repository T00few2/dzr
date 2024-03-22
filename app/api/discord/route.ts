import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export async function GET(req: NextApiRequest, res: NextApiResponse) {
  // Handle GET request
  return new Response('Hello')
}

export async function POST(req: NextApiRequest, res: NextApiResponse) {
  const webhookUrl = 'https://discord.com/api/webhooks/1220454320777072721/WUKlYyFtiTRgJvOBM3e3l7uU3hX4XBNiylzNgKrSfu2SPOWWUwdPOebeLmoWGyC1hA78'
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
      console.log('Message with image sent to Discord successfully!');
      res.status(200).json({ message: 'Message with image sent to Discord successfully!' });
  } catch (error) {
      console.error('Error sending message to Discord:', error);
      res.status(500).json({ message: 'Error sending message to Discord' });
  }
}