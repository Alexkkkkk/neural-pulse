if (typeof window !== 'undefined') {
(function() {
    const API_BASE = window.location.origin;
    const tg = window.Telegram?.WebApp;

    let gameState = { userId: null, score: 0, clickLvl: 1, botLvl: 0 };

    async function init() {
        if (tg) {
            tg.expand();
            tg.ready();
            gameState.userId = tg.initDataUnsafe?.user?.id || "123456789";
        } else {
            gameState.userId = "123456789";
        }
        await loadBalance();
        updateJackpotDisplay();
        setInterval(updateJackpotDisplay, 20000);
        setInterval(autoSave, 30000);
    }

    async function loadBalance() {
        try {
            const res = await fetch(`${API_BASE}/api/balance/${gameState.userId}`);
            const result = await res.json();
            if (result.status === 'ok') {
                gameState.score = result.data.balance;
                gameState.clickLvl = result.data.click_lvl;
                gameState.botLvl = result.data.bot_lvl;
                updateUI();
            }
        } catch (e) { console.error("Balance error:", e); }
    }

    async function updateJackpotDisplay() {
        try {
            const res = await fetch(`${API_BASE}/api/jackpot`);
            const result = await res.json();
            if (result.status === 'ok') {
                const el = document.getElementById('jackpot-amount');
                if (el) el.innerText = `🎰 JACKPOT: ${result.data.amount.toLocaleString()}`;
            }
        } catch (e) { }
    }

    async function autoSave() {
        try {
            await fetch(`${API_BASE}/api/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: parseInt(gameState.userId),
                    score: Math.floor(gameState.score),
                    click_lvl: gameState.clickLvl,
                    bot_lvl: gameState.botLvl
                })
            });
        } catch (e) { }
    }

    function handleMainClick() {
        gameState.score += gameState.clickLvl;
        updateUI();
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }

    // ТВОЯ ИСПРАВЛЕННАЯ ФУНКЦИЯ
    function updateUI() {
        const scoreEl = document.getElementById('balance');
        if (scoreEl) {
            scoreEl.innerText = Math.floor(gameState.score).toLocaleString();
        }
        // Если мы в Telegram, обновляем заголовок
        if (tg) {
            tg.headerColor = gameState.score > 1000 ? "#ff0000" : "#000000";
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    const coin = document.getElementById('coin');
    if (coin) coin.addEventListener('click', handleMainClick);
})();
}
