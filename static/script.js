
async function updateJackpotDisplay() {
    const response = await fetch('/api/jackpot');
    const result = await response.json();
    if (result.status === 'ok') {
        document.getElementById('jackpot-amount').innerText = `🎰 Jackpot: ${result.data.amount}`;
    }
}

// Запускай обновление каждые 10 секунд
setInterval(updateJackpotDisplay, 10000);
