let tg = window.Telegram.WebApp;
tg.expand();

// Основные переменные состояния
let score = 0, clickLvl = 1, botLvl = 0, leagueId = 1;
let energy = 1000, maxEnergy = 1000;
let currentJp = 0;

// Получаем ID пользователя из Telegram или ставим 123 для тестов в браузере
const userId = tg.initDataUnsafe?.user?.id || 123;

// Константы лиг
const LEAGUE_TARGETS = [600000, 900000, 1400000, 2100000, 3000000, 4100000, 5400000, 6900000, 8600000, 10500000, 12600000, 14900000, 17400000, 20100000, 23000000, 26100000, 29400000, 32900000, 36600000, 40500000];
const LEAGUE_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster", "Elite", "Legend", "Mythic", "Titan", "Immortal", "Ether", "Void", "Solar", "Galactic", "Universal", "Cosmic", "Divine", "Neural God"];

// Загрузка данных при старте
async function load() {
    try {
        const res = await fetch(`/api/balance/${userId}`);
        const d = await res.json();
        
        score = d.balance || 0;
        clickLvl = d.click_lvl || 1;
        botLvl = d.bot_lvl || 0;
        leagueId = d.league_id || 1;
        
        // Офлайн прибыль
        if(d.offline_profit > 0) {
            tg.showAlert(`Ваши боты добыли, пока вас не было: ${d.offline_profit} 💎`);
        }
        
        update();
        console.log("✅ Данные загружены");
    } catch (e) {
        console.error("❌ Ошибка загрузки:", e);
    }
}

// Обновление интерфейса
function update() {
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.innerText = Math.floor(score).toLocaleString();
    
    const leagueNameEl = document.getElementById('league-name');
    if (leagueNameEl) leagueNameEl.innerText = LEAGUE_NAMES[leagueId-1] + " League";
    
    const jpValEl = document.getElementById('jackpot-val');
    if (jpValEl) jpValEl.innerText = Math.floor(currentJp).toLocaleString();
    
    // Обновление цен и уровней в модалках
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
    const leaguePerc = document.getElementById('league-percent');
    if (leagueFill) leagueFill.style.width = `${Math.min(100, prog)}%`;
    if (leaguePerc) leaguePerc.innerText = `${Math.floor(Math.min(100, prog))}%`;

    // Энергия
    const energyStat = document.getElementById('energy-stat');
    const energyFill = document.getElementById('energy-fill');
    if (energyStat) energyStat.innerText = `${Math.floor(energy)}/${maxEnergy}`;
    if (energyFill) energyFill.style.width = `${(energy / maxEnergy) * 100}%`;
}

// Обработка клика (TouchStart для мобилок)
const btn = document.getElementById('btn');
if (btn) {
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (energy >= clickLvl) {
                score += clickLvl;
                energy -= clickLvl;
                
                // Проверка лиги
                if (score >= LEAGUE_TARGETS[leagueId-1] && leagueId < 20) {
                    leagueId++;
                    tg.showAlert(`Поздравляем! Вы перешли в лигу: ${LEAGUE_NAMES[leagueId-1]}`);
                }

                // Шанс джекпота
                if (Math.random() < 0.00001 && currentJp > 0) {
                    winJackpot();
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
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.position = 'absolute';
    p.style.color = '#00f2ff';
    p.style.fontWeight = 'bold';
    p.style.pointerEvents = 'none';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
}

// Модальные окна
window.openModal = function(id) {
    document.getElementById('modal-' + id).classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

window.closeModals = function() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('overlay').classList.remove('active');
}

// Покупки
const buyClick = document.getElementById('buy-click');
if (buyClick) {
    buyClick.onclick = () => {
        let cost = clickLvl * 500;
        if(score >= cost) {
            score -= cost;
            clickLvl++;
            update();
            save();
        } else {
            tg.showAlert("Недостаточно 💎");
        }
    };
}

const buyBot = document.getElementById('buy-bot');
if (buyBot) {
    buyBot.onclick = () => {
        let cost = (botLvl + 1) * 1500;
        if(score >= cost) {
            score -= cost;
            botLvl++;
            update();
            save();
        } else {
            tg.showAlert("Недостаточно 💎");
        }
    };
}

function winJackpot() {
    const winSc = document.getElementById('win-screen');
    const winAm = document.getElementById('win-amount');
    if (winAm) winAm.innerText = Math.floor(currentJp).toLocaleString();
    if (winSc) winSc.style.display = 'flex';
    score += currentJp;
    currentJp = 0;
    save();
}

// Сохранение
async function save() {
    try {
        const res = await fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: userId, 
                score: Math.floor(score), 
                league_id: leagueId, 
                click_lvl: clickLvl, 
                bot_lvl: botLvl
            })
        });
        const d = await res.json();
        if(d.global_jackpot !== undefined) {
            currentJp = d.global_jackpot;
            update();
        }
    } catch (e) {
        console.error("Ошибка сохранения:", e);
    }
}

// Таймеры
setInterval(() => {
    // Регенерация энергии
    if (energy < maxEnergy) {
        energy = Math.min(maxEnergy, energy + 1.5);
    }
    // Работа авто-бота
    if (botLvl > 0) {
        score += (botLvl * 0.2);
    }
    update();
}, 1000);

// Автосохранение каждые 15 сек
setInterval(save, 15000);

// Инициализация
load();
