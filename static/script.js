let tg = window.Telegram.WebApp;
tg.expand();

// Данные авторизации (ТОТ САМЫЙ ТОКЕН)
const authData = tg.initData;

// Основные переменные состояния
let score = 0, clickLvl = 1, botLvl = 0, leagueId = 1;
let energy = 1000, maxEnergy = 1000;
let currentJp = 0;

// Получаем ID пользователя
const userId = tg.initDataUnsafe?.user?.id || 123;

// Константы лиг
const LEAGUE_TARGETS = [600000, 900000, 1400000, 2100000, 3000000, 4100000, 5400000, 6900000, 8600000, 10500000, 12600000, 14900000, 17400000, 20100000, 23000000, 26100000, 29400000, 32900000, 36600000, 40500000];
const LEAGUE_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster", "Elite", "Legend", "Mythic", "Titan", "Immortal", "Ether", "Void", "Solar", "Galactic", "Universal", "Cosmic", "Divine", "Neural God"];

// Универсальная функция для запросов с авторизацией
async function apiRequest(url, method = 'GET', body = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData}` // Добавляем токен здесь
        }
    };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(url, options);
    if (res.status === 401) {
        console.error("Ошибка авторизации: проверьте Bearer token");
    }
    return await res.json();
}

// Загрузка данных
async function load() {
    try {
        const d = await apiRequest(`/api/balance/${userId}`);
        if (d.status === "ok" || d.balance !== undefined) {
            score = d.data?.balance || d.balance || 0;
            clickLvl = d.data?.click_lvl || d.click_lvl || 1;
            botLvl = d.data?.bot_lvl || d.bot_lvl || 0;
            leagueId = d.data?.league_id || d.league_id || 1;
            
            if(d.data?.offline_profit > 0) {
                tg.showAlert(`Ваши боты добыли: ${d.data.offline_profit} 💎`);
            }
            update();
        }
    } catch (e) {
        console.error("❌ Ошибка загрузки:", e);
    }
}

// Сохранение
async function save() {
    try {
        const d = await apiRequest('/api/save', 'POST', {
            user_id: userId, 
            score: Math.floor(score), 
            league_id: leagueId, 
            click_lvl: clickLvl, 
            bot_lvl: botLvl
        });
        
        if(d && d.global_jackpot !== undefined) {
            currentJp = d.global_jackpot;
            update();
        }
    } catch (e) {
        console.error("Ошибка сохранения:", e);
    }
}

// Обновление интерфейса
function update() {
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.innerText = Math.floor(score).toLocaleString();
    
    const leagueNameEl = document.getElementById('league-name');
    if (leagueNameEl) leagueNameEl.innerText = (LEAGUE_NAMES[leagueId-1] || "Max") + " League";
    
    const jpValEl = document.getElementById('jackpot-val');
    if (jpValEl) jpValEl.innerText = Math.floor(currentJp).toLocaleString();
    
    const tapLvlEl = document.getElementById('tap-lvl');
    const autoLvlEl = document.getElementById('auto-lvl');
    if (tapLvlEl) tapLvlEl.innerText = clickLvl;
    if (autoLvlEl) autoLvlEl.innerText = botLvl;

    const buyClickBtn = document.getElementById('buy-click');
    const buyBotBtn = document.getElementById('buy-bot');
    if (buyClickBtn) buyClickBtn.innerHTML = `MULTI-TAP (LVL ${clickLvl})<br><small>Цена: ${clickLvl * 500} 💎</small>`;
    if (buyBotBtn) buyBotBtn.innerHTML = `AUTO-BOT (LVL ${botLvl})<br><small>Цена: ${(botLvl + 1) * 1500} 💎</small>`;

    // Прогресс лиги
    let prev = leagueId === 1 ? 0 : LEAGUE_TARGETS[leagueId-2];
    let next = LEAGUE_TARGETS[leagueId-1];
    let prog = ((score - prev) / (next - prev)) * 100;
    const leagueFill = document.getElementById('league-fill');
    if (leagueFill) leagueFill.style.width = `${Math.min(100, prog)}%`;

    // Энергия
    const energyStat = document.getElementById('energy-stat');
    const energyFill = document.getElementById('energy-fill');
    if (energyStat) energyStat.innerText = `${Math.floor(energy)}/${maxEnergy}`;
    if (energyFill) energyFill.style.width = `${(energy / maxEnergy) * 100}%`;
}

// Обработка клика
const btn = document.getElementById('btn');
if (btn) {
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (energy >= clickLvl) {
                score += clickLvl;
                energy -= clickLvl;
                
                if (score >= LEAGUE_TARGETS[leagueId-1] && leagueId < 20) {
                    leagueId++;
                    tg.showAlert(`Лига повышена: ${LEAGUE_NAMES[leagueId-1]}`);
                }

                tg.HapticFeedback.impactOccurred('light');
                spawnParticle(e.changedTouches[i].pageX, e.changedTouches[i].pageY);
            }
        }
        update();
    });
}

function spawnParticle(x, y) {
    const p = document.createElement('div');
    p.innerText = `+${clickLvl}`;
    p.className = 'plus-animation';
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
}

// Покупки
document.getElementById('buy-click').onclick = () => {
    let cost = clickLvl * 500;
    if(score >= cost) {
        score -= cost; clickLvl++; update(); save();
    } else tg.showAlert("Недостаточно 💎");
};

document.getElementById('buy-bot').onclick = () => {
    let cost = (botLvl + 1) * 1500;
    if(score >= cost) {
        score -= cost; botLvl++; update(); save();
    } else tg.showAlert("Недостаточно 💎");
};

// Таймеры
setInterval(() => {
    if (energy < maxEnergy) energy = Math.min(maxEnergy, energy + 1.5);
    if (botLvl > 0) score += (botLvl * 0.2);
    update();
}, 1000);

setInterval(save, 15000);
load();
