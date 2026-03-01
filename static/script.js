if (typeof window !== 'undefined') {
(function() {
    const API_BASE = window.location.origin;
    const tg = window.Telegram?.WebApp;

    let gameState = { userId: null, score: 0, clickLvl: 1, botLvl: 0 };

    async function init() {
        console.log("🎮 Инициализация игры...");
        if (tg) {
            tg.expand();
            tg.ready();
            gameState.userId = tg.initDataUnsafe?.user?.id || "123456789";
        } else {
            gameState.userId = "123456789";
        }
        
        console.log("👤 User ID:", gameState.userId);
        
        await loadBalance();
        updateJackpotDisplay();
        
        setInterval(updateJackpotDisplay, 20000);
        setInterval(autoSave, 30000);
    }

    // ТВОЯ ОБНОВЛЕННАЯ ФУНКЦИЯ С ЛОГАМИ
    async function loadBalance() {
        console.log("📡 Запрос баланса для ID:", gameState.userId);
        try {
            const res = await fetch(`${API_BASE}/api/balance/${gameState.userId}`);
            console.log("📡 Ответ сервера получен:", res.status);
            
            if (!res.ok) {
                console.error("❌ Сервер ответил ошибкой:", res.status);
                return;
            }

            const result = await res.json();
            console.log("📦 Данные от сервера:", result);

            if (result.status === 'ok') {
                gameState.score = result.data.balance;
                gameState.clickLvl = result.data.click_lvl;
                gameState.botLvl = result.data.bot_lvl;
                updateUI();
                console.log("✅ Баланс успешно обновлен в UI");
            }
        } catch (e) { 
            console.error("❌ Ошибка сети или сервера:", e); 
        }
    }

    async function updateJackpotDisplay() {
        try {
            const res = await fetch(`${API_BASE}/api/jackpot`);
            const result = await res.json();
            if (result.status === 'ok') {
                const el = document.getElementById('jackpot-amount');
                if (el) el.innerText = `🎰 JACKPOT: ${result.data.amount.toLocaleString()}`;
            }
        } catch (e) { 
            console.log("🎰 Джекпот пока недоступен");
        }
    }

    async function autoSave() {
        console.log("💾 Попытка автосохранения...");
        try {
            const res = await fetch(`${API_BASE}/api/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: parseInt(gameState.userId),
                    score: Math.floor(gameState.score),
                    click_lvl: gameState.clickLvl,
                    bot_lvl: gameState.botLvl
                })
            });
            if (res.ok) console.log("💾 Прогресс сохранен");
        } catch (e) { 
            console.error("❌ Ошибка сохранения:", e);
        }
    }

    function handleMainClick() {
        gameState.score += gameState.clickLvl;
        updateUI();
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }

    function updateUI() {
        const scoreEl = document.getElementById('balance');
        if (scoreEl) {
            scoreEl.innerText = Math.floor(gameState.score).toLocaleString();
        }
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
