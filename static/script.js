// --- КОНФИГУРАЦИЯ ---
const API_BASE = window.location.origin; // Автоматически определит https://np.bothost.ru
let tg = window.Telegram.WebApp;

// Состояние игры (примерное)
let gameState = {
    userId: null,
    score: 0,
    clickLvl: 1,
    botLvl: 0,
    lastSave: Date.now()
};

// --- ИНИЦИАЛИЗАЦИЯ ---
tg.expand(); // Развернуть на весь экран
gameState.userId = tg.initDataUnsafe?.user?.id || "123456789"; // ID из Телеграм или тестовый

// Загрузка данных при старте
async function initGame() {
    console.log("🎮 Инициализация интерфейса...");
    await loadBalance();
    updateJackpotDisplay();
    
    // Запускаем циклы
    setInterval(updateJackpotDisplay, 15000); // Джекпот раз в 15 сек
    setInterval(autoSave, 30000); // Автосохранение раз в 30 сек
}

// --- ФУНКЦИИ API ---

// 1. Загрузка баланса и офлайн-профита
async function loadBalance() {
    try {
        const response = await fetch(`${API_BASE}/api/balance/${gameState.userId}`);
        const result = await response.json();
        
        if (result.status === 'ok') {
            const data = result.data;
            gameState.score = data.balance;
            gameState.clickLvl = data.click_lvl;
            gameState.botLvl = data.bot_lvl;
            
            updateUI();
            
            if (data.offline_profit > 0) {
                tg.showAlert(`🤖 Твои боты намайнили: ${data.offline_profit} монет!`);
            }
        }
    } catch (e) {
        console.error("Ошибка загрузки баланса:", e);
    }
}

// 2. Обновление отображения Джекпота (Исправлено!)
async function updateJackpotDisplay() {
    try {
        const response = await fetch(`${API_BASE}/api/jackpot`);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const result = await response.json();
        if (result.status === 'ok') {
            const jackpotEl = document.getElementById('jackpot-amount');
            if (jackpotEl) {
                jackpotEl.innerText = `🎰 JACKPOT: ${result.data.amount.toLocaleString()}`;
            }
        }
    } catch (e) {
        console.error("Ошибка джекпота (проверь API):", e);
    }
}

// 3. Попытка сорвать Джекпот и сохранение
async function autoSave() {
    try {
        // Сначала сохраняем прогресс
        await fetch(`${API_BASE}/api/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: gameState.userId,
                score: gameState.score,
                click_lvl: gameState.clickLvl,
                bot_lvl: gameState.botLvl
            })
        });

        // Пытаемся выиграть джекпот
        const jackRes = await fetch(`${API_BASE}/api/jackpot/try`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: gameState.userId, score: gameState.score })
        });
        
        const jackData = await jackRes.json();
        if (jackData.data?.win) {
            tg.showPopup({
                title: '🎰 JACKPOT!!!',
                message: `Ты выиграл ${jackData.data.amount} монет!`,
                buttons: [{type: 'ok'}]
            });
            await loadBalance(); // Перезагружаем баланс после выигрыша
        }
    } catch (e) {
        console.warn("Автосохранение не удалось:", e);
    }
}

// 4. Получение Лидерборда
async function showLeaderboard() {
    try {
        const response = await fetch(`${API_BASE}/api/leaderboard?user_id=${gameState.userId}`);
        const result = await response.json();
        if (result.status === 'ok') {
            console.log("Leaderboard Data:", result.data);
            // Тут логика отрисовки таблицы в твоем модальном окне
        }
    } catch (e) {
        console.error("Ошибка лидерборда:", e);
    }
}

// --- ЛОГИКА КЛИКА ---
function handleMainClick() {
    gameState.score += gameState.clickLvl;
    updateUI();
    
    // Эффект вибрации (только на телефонах)
    tg.HapticFeedback.impactOccurred('light');
}

function updateUI() {
    const balanceEl = document.getElementById('balance');
    if (balanceEl) {
        balanceEl.innerText = Math.floor(gameState.score).toLocaleString();
    }
}

// --- ЗАПУСК ---
document.addEventListener('DOMContentLoaded', initGame);

// Пример вешания клика на картинку (если ID 'coin')
const coinBtn = document.getElementById('coin');
if (coinBtn) {
    coinBtn.addEventListener('click', handleMainClick);
}
