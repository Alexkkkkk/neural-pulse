// --- НАСТРОЙКИ И СОСТОЯНИЕ ---
let tg = window.Telegram.WebApp;
tg.expand(); // Разворачиваем на весь экран

let score = 0;
let clickLvl = 1;
let botLvl = 0;
let leagueId = 1;
const userId = tg.initDataUnsafe?.user?.id || 12345; // ID пользователя из Telegram

// Элементы DOM (убедись, что в index.html такие же id)
const scoreEl = document.getElementById('score');
const clickBtn = document.getElementById('click-btn');
const buyClickBtn = document.getElementById('buy-click');
const buyBotBtn = document.getElementById('buy-bot');

// --- ЗАГРУЗКА ДАННЫХ ПРИ СТАРТЕ ---
async function loadData() {
    try {
        const response = await fetch(`/api/balance/${userId}`);
        const data = await response.json();
        
        score = data.balance;
        clickLvl = data.click_lvl;
        botLvl = data.bot_lvl;
        leagueId = data.league_id;

        updateUI();
        if (data.offline_profit > 0) {
            tg.showAlert(`Пока тебя не было, боты добыли: ${data.offline_profit} 💎`);
        }
    } catch (e) {
        console.error("Ошибка загрузки:", e);
    }
}

// --- КЛИК И ПРОКАЧКА ---
clickBtn.addEventListener('click', () => {
    score += clickLvl;
    updateUI();
    vibrate(); // Вибрация при клике
});

buyClickBtn.addEventListener('click', () => {
    let cost = clickLvl * 500;
    if (score >= cost) {
        score -= cost;
        clickLvl++;
        updateUI();
        saveProgress();
    } else {
        tg.HapticFeedback.notificationOccurred('error');
    }
});

buyBotBtn.addEventListener('click', () => {
    let cost = (botLvl + 1) * 1500;
    if (score >= cost) {
        score -= cost;
        botLvl++;
        updateUI();
        saveProgress();
    }
});

// --- СОХРАНЕНИЕ ---
async function saveProgress() {
    const data = {
        user_id: userId,
        score: Math.floor(score),
        league_id: leagueId,
        click_lvl: clickLvl,
        bot_lvl: botLvl,
        won_jackpot: false
    };

    try {
        await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error("Ошибка сохранения:", e);
    }
}

// Обновление интерфейса
function updateUI() {
    scoreEl.innerText = Math.floor(score).toLocaleString();
    buyClickBtn.innerText = `Улучшить клик (Lvl ${clickLvl}) - ${clickLvl * 500}`;
    buyBotBtn.innerText = `Купить бота (Lvl ${botLvl}) - ${(botLvl + 1) * 1500}`;
}

function vibrate() {
    tg.HapticFeedback.impactOccurred('medium');
}

// Авто-сохранение каждые 10 секунд
setInterval(saveProgress, 10000);

// Запуск
loadData();
