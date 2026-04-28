async function sendTelegramMessage({ botToken, chatId, text }) {
  if (!botToken || !chatId) {
    throw new Error('Missing Telegram botToken or chatId');
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || 'Failed to send Telegram message');
  }

  return payload;
}

module.exports = {
  sendTelegramMessage
};
