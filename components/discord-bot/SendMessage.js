// components/discord-bot/SendMessage.js
const SendMessage = async (channelId, message) => {
  try {
    const response = await fetch('/api/discord-bot/sendMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelId, messageContent: message }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to send message:', data.error);
      alert('Error sending message');
    } else {
      console.log('Message sent successfully:', data.message.content);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('An error occurred');
  }
};

export default SendMessage;
