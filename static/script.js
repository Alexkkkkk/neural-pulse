let tg = window.Telegram.WebApp;
tg.expand();

// Основные переменные состояния
let score = 0, clickLvl = 1, botLvl = 0, leagueId = 1;
let energy = 1000, maxEnergy = 1000;
let currentJp = 0;

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
        
        // Добавляем офлайн прибыль, если она есть
        if(d.offline_profit > 0) {
            score += d.offline_profit;
            tg.showAlert(`Ваши боты добыли, пока вас не было: ${d.offline_profit} 💎`);
        }
        
        update();
    } catch (e) {
        console.error("Ошибка загрузки:", e);
    }
}

// Обновление интерфейса
function update() {
    // Числа и тексты
    document.getElementById('score').innerText = Math.floor(score).toLocaleString();
    document.getElementById('league-name').innerText = LEAGUE_NAMES[leagueId-1] + " League";
    document.getElementById('jackpot-val').innerText = Math.floor(currentJp).toLocaleString();
    
    // Обновление цен в модальном окне
    document.getElementById('tap-lvl').innerText = clickLvl;
    document.getElementById('auto-lvl').innerText = botLvl;
    document.getElementById('buy-click').innerHTML = `MULTI-TAP (LVL ${clickLvl})<br><small>Цена: ${clickLvl * 500} 💎</small>`;
    document.getElementById('buy-bot').innerHTML = `AUTO-BOT (LVL ${botLvl})<br><small>Цена: ${(botLvl + 1) * 1500} 💎</small>`;

    // Прогресс лиги
    let prev = leagueId === 1 ? 0 : LEAGUE_TARGETS[leagueId-2];
    let next = LEAGUE_TARGETS[leagueId-1];
    let prog = ((score - prev) / (next - prev)) * 100;
    
    document.getElementById('league-fill').style.width = `${Math.min(100, prog)}%`;
    document.getElementById('league-percent').innerText = `${Math.floor(Math.min(100, prog))}%`;

    // Прогресс джекпота (визуально до 1% от цели лиги)
    let jpGoal = next * 0.01;
    let jpProg = (currentJp / jpGoal) * 100;
    document.getElementById('jp-fill').style.width = `${Math.min(100, jpProg)}%`;

    // Энергия
    document.getElementById('energy-stat').innerText = `${Math.floor(energy)}/${maxEnergy}`;
    document.getElementById('energy-fill').style.width = `${(energy / maxEnergy) * 100}%`;
}

// Обработка клика по кнопке
document.getElementById('btn').addEventListener('touchstart', (e) => {
    e.preventDefault(); // Запрет зума и скролла
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (energy >= clickLvl) {
            // Логика клика
            score += clickLvl;
            energy -= clickLvl;
            
            // Проверка новой лиги
            if (score >= LEAGUE_TARGETS[leagueId-1] && leagueId < 20) {
                leagueId++;
                tg.showAlert(`Поздравляем! Вы перешли в лигу: ${LEAGUE_NAMES[leagueId-1]}`);
            }

            // Шанс выпадения джекпота (0.001%)
            if (Math.random() < 0.00001 && currentJp > 0) {
                winJackpot();
            }

            // Эффекты
            tg.HapticFeedback.impactOccurred('light');
            spawnParticle(e.changedTouches[i].pageX, e.changedTouches[i].pageY);
        }
    }
    update();
});

function spawnParticle(x, y) {
    const p = document.createElement('div');
    p.innerText = `+${clickLvl}`;
    p.className = 'plus-animation';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
}

// Модальные окна
function openModal(id) {
    document.getElementById('modal-' + id).classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('overlay').classList.remove('active');
}

// Покупки улучшений
document.getElementById('buy-click').onclick = () => {
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

document.getElementById('buy-bot').onclick = () => {
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

// Функция выигрыша джекпота
function winJackpot() {
    document.getElementById('win-amount').innerText = Math.floor(currentJp).toLocaleString();
    document.getElementById('win-screen').style.display = 'flex';
    score += currentJp;
    currentJp = 0;
    save();
}

// Сохранение на сервер
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

// Автосохранение каждые 15 секунд
setInterval(save, 15000);

// Инициализация
load();
