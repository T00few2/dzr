import axios from 'axios';

export async function sendDiscordMessage(webhookUrl: string, message: string, imageUrl: string): Promise<void> {
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
    } catch (error) {
        console.error('Error sending message to Discord:', error);
    }
}

sendDiscordMessage('https://discord.com/api/webhooks/1220454320777072721/WUKlYyFtiTRgJvOBM3e3l7uU3hX4XBNiylzNgKrSfu2SPOWWUwdPOebeLmoWGyC1hA78','Todays profile!','https://dzrracingseries.com/dzr-after-party/libby-hill-after-party+/Libby-Hill-After-Party+-profile.png')