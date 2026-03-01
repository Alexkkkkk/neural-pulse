/**
 * NEURAL PULSE - Frontend Logic
 * Защищенная версия для Bothost
 */

(function() {
    // Проверка: если скрипт запущен в Node.js (на сервере), а не в браузере — выходим
    if (typeof window === 'undefined') {
        return;
    }

    // --- НАСТРОЙКИ ---
    const API_BASE = window.location.origin;
    const tg = window.Telegram?.WebApp;

    let gameState = {
        userId: null,
        score: 0,
        clickLvl: 1,
        botLvl: 0,
        lastSave: Date.now()
    };

    // --- ИНИЦИАЛИЗАЦИЯ ---
    function init() {
        if (tg) {
            tg.expand();
            tg.ready();
            gameState.userId = tg.initDataUnsafe?.user?.id || "123456789";
        } else {
            gameState.userId = "123456789"; // Для тестов в обычном браузере
        }

        console.log("🎮 Game starting for user:", gameState.userId);
        
        loadBalance();
        updateJackpotDisplay();

        // Интервалы
        setInterval(updateJackpotDisplay, 20000); // Джекпот раз в 20 сек
        setInterval(autoSave, 30000);             // Автосейв раз в 30 сек
    }

    // --- API ФУНКЦИИ ---

    // 1. Загрузка баланса
    async function loadBalance() {
        try {
            const res = await fetch(`${API_BASE}/api/balance/${gameState.userId}`);
            const result = await res.json();
            
            if (result.status === 'ok') {
                const data = result.data;
                gameState.score = data.balance;
                gameState.clickLvl = data.click_lvl;
                gameState.botLvl = data.bot_lvl;
                
                updateUI();
                
                if (data.offline_profit > 0) {
                    tg?.showPopup({
                        title: 'Роботы работали!',
                        message: `Пока тебя не было, намайнено: ${data.offline_profit}`,
                        buttons: [{type: 'ok'}]
                    });
                }
            }
        } catch (e) {
            console.error("Ошибка API balance:", e);
        }
    }

    // 2. Обновление джекпота
    async function updateJackpotDisplay() {
        try {
            const res = await fetch(`${API_BASE}/api/jackpot`);
            const result = await res.json();
            if (result.status === 'ok') {
                const el = document.getElementById('jackpot-amount');
                if (el) el.innerText = `🎰 JACKPOT: ${result.data.amount.toLocaleString()}`;
            }
        } catch (e) {
            console.warn("Не удалось обновить джекпот");
        }
    }

    // 3. Сохранение и попытка джекпота
    async function autoSave() {
        const payload = {
            user_id: parseInt(gameState.userId),
            score: Math.floor(gameState.score),
            click_lvl: gameState.clickLvl,
            bot_lvl: gameState.botLvl
        };

        try {
            // Сохраняем прогресс
            await fetch(`${API_BASE}/api/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Проверка джекпота
            const jackRes = await fetch(`${API_BASE}/api/jackpot/try`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const jackData = await jackRes.json();
            if (jackData.data?.win) {
                tg?.showAlert(`🔥 НЕВЕРОЯТНО! Вы сорвали Джекпот: ${jackData.data.amount}!`);
                loadBalance();
            }
        } catch (e) {
            console.error("Ошибка сохранения");
        }
    }

    // --- ЛОГИКА ИГРЫ ---
    function handleMainClick(e) {
        gameState.score += gameState.clickLvl;
        updateUI();

        // Визуальный эффект (если есть функция создания вылетающих цифр)
        if (typeof createFloatingText === 'function') {
            createFloatingText(e.clientX, e.clientY, `+${gameState.clickLvl}`);
        }

        // Вибрация
        tg?.HapticFeedback.impactOccurred('light');
    }

    function updateUI() {
        const scoreEl = document.getElementById('balance');
        if (scoreEl) scoreEl.innerText = Math.floor(gameState.score).toLocaleString();
    }

    // --- ЗАПУСК ПОСЛЕ ЗАГРУЗКИ DOM ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Привязка клика
    const coin = document.getElementById('coin');
    if (coin) {
        coin.addEventListener('click', handleMainClick);
    }

})();
