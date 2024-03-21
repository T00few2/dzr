import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const webhookUrl = 'https://discord.com/api/webhooks/1220454320777072721/WUKlYyFtiTRgJvOBM3e3l7uU3hX4XBNiylzNgKrSfu2SPOWWUwdPOebeLmoWGyC1hA78';
    const message = 'Todays profile!';
    const imageUrl ='https://dzrracingseries.com/dzr-after-party/libby-hill-after-party+/Libby-Hill-After-Party+-profile.png';

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
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending message to Discord:', error);
        res.status(500).json({ success: false, error: 'Failed to send message to Discord' });
    }
}