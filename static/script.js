let tg = window.Telegram.WebApp;
tg.expand();

let score = 0;
let clickLvl = 1;
let botLvl = 0;
let leagueId = 1;
const userId = tg.initDataUnsafe?.user?.id || 123;

const scoreEl = document.getElementById('score');
const clickBtn = document.getElementById('click-btn');
const buyClickBtn = document.getElementById('buy-click');
const buyBotBtn = document.getElementById('buy-bot');

async function load() {
    const res = await fetch(`/api/balance/${userId}`);
    const d = await res.json();
    score = d.balance + (d.offline_profit || 0);
    clickLvl = d.click_lvl;
    bot_lvl = d.bot_lvl;
    if(d.offline_profit > 0) tg.showAlert(`Боты принесли: ${d.offline_profit} 💎`);
    update();
}

function update() {
    scoreEl.innerText = Math.floor(score).toLocaleString();
    buyClickBtn.innerText = `Улучшить клик (Lvl ${clickLvl}) - ${clickLvl * 500} 💎`;
    buyBotBtn.innerText = `Авто-бот (Lvl ${botLvl}) - ${(botLvl + 1) * 1500} 💎`;
}

clickBtn.onclick = () => {
    score += clickLvl;
    tg.HapticFeedback.impactOccurred('medium');
    update();
};

buyClickBtn.onclick = async () => {
    let price = clickLvl * 500;
    if (score >= price) {
        score -= price; clickLvl++; update(); save();
    }
};

buyBotBtn.onclick = async () => {
    let price = (botLvl + 1) * 1500;
    if (score >= price) {
        score -= price; botLvl++; update(); save();
    }
};

async function save() {
    await fetch('/api/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user_id: userId, score: Math.floor(score), league_id: 1, click_lvl: clickLvl, bot_lvl: botLvl})
    });
}

setInterval(save, 10000); // Автосохранение каждые 10 сек
load();
