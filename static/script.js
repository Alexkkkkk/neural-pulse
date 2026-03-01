if (typeof window !== 'undefined') {
(function() {
    // Автоматически определяем адрес: если сидим на домене bothost - используем его, иначе ставим вручную
    const API_BASE = window.location.origin.includes('bothost.ru') 
        ? window.location.origin 
        : "https://np.bothost.ru";

    const tg = window.Telegram?.WebApp;

    // Глобальное состояние игры
    let gameState = { 
        userId: null, 
        score: 0, 
        energy: 1000, 
        maxEnergy: 1000, 
        clickLvl: 1, 
        botLvl: 0, 
        rocketActive: false 
    };

    const LEAGUES = [
        { name: "BRONZE", min: 0, color: "#cd7f32" },
        { name: "SILVER", min: 50000, color: "#c0c0c0" },
        { name: "GOLD", min: 250000, color: "#ffd700" }
    ];

    async function init() {
        if (tg) {
            tg.expand();
            gameState.userId = tg.initDataUnsafe?.user?.id || "123456789";
            document.getElementById('user-id-display').textContent = "ID: " + gameState.userId;
        } else {
            gameState.userId = "123456789";
        }
        
        await loadBalance();
        
        // Показываем интерфейс после загрузки данных
        document.getElementById('game').style.opacity = '1';

        // Запуск циклов
        setInterval(updateJackpotDisplay, 10000);
        setInterval(autoSave, 20000); // Сохранение каждые 20 сек
        setInterval(gameLoop, 1000);
    }

    async function loadBalance() {
        try {
            const res = await fetch(`${API_BASE}/api/balance/${gameState.userId}`);
            const result = await res.json();
            if (result.status === 'ok') {
                gameState.score = result.data.balance;
                gameState.clickLvl = result.data.click_lvl || 1;
                gameState.botLvl = result.data.bot_lvl || 0;
                updateUI();
            }
        } catch (e) { console.error("Ошибка загрузки баланса:", e); }
    }

    function updateUI() {
        const scoreEl = document.getElementById('score');
        const energyStat = document.getElementById('energy-stat');
        const energyFill = document.getElementById('energy-fill');
        const leagueName = document.getElementById('league-name');
        const leagueFill = document.getElementById('league-fill');
        const tapLvlVal = document.getElementById('tap-lvl-val');
        const autoLvlVal = document.getElementById('auto-lvl-val');

        if (scoreEl) scoreEl.innerText = Math.floor(gameState.score).toLocaleString();
        if (energyStat) energyStat.textContent = `${Math.floor(gameState.energy)}/${gameState.maxEnergy}`;
        if (energyFill) energyFill.style.width = (gameState.energy / gameState.maxEnergy * 100) + '%';
        if (tapLvlVal) tapLvlVal.textContent = gameState.clickLvl;
        if (autoLvlVal) autoLvlVal.textContent = gameState.botLvl;

        // Логика лиг
        let current = LEAGUES[0], next = LEAGUES[1];
        for (let i = 0; i < LEAGUES.length; i++) {
            if (gameState.score >= LEAGUES[i].min) {
                current = LEAGUES[i];
                next = LEAGUES[i+1] || null;
            }
        }

        if (leagueName) {
            leagueName.textContent = current.name + " LEAGUE";
            leagueName.style.color = current.color;
        }
        if (leagueFill) {
            leagueFill.style.background = current.color;
            if (next) {
                let prog = ((gameState.score - current.min) / (next.min - current.min)) * 100;
                leagueFill.style.width = Math.min(100, prog) + '%';
            } else {
                leagueFill.style.width = '100%';
            }
        }
    }

    function handleMainClick(e) {
        e.preventDefault();
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        
        let power = gameState.rocketActive ? gameState.clickLvl * 5 : gameState.clickLvl;
        
        if (gameState.rocketActive || gameState.energy >= gameState.clickLvl) {
            if (!gameState.rocketActive) gameState.energy -= 1;
            gameState.score += power;
            
            spawnPlus(touch.pageX, touch.pageY, power);
            updateUI();
            
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        }
    }

    function spawnPlus(x, y, val) {
        const p = document.createElement('div');
        p.className = 'plus-animation';
        p.style.left = x + 'px'; p.style.top = y + 'px';
        p.style.color = 'var(--neon)';
        p.textContent = `+${val}`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 700);
    }

    // Обработка покупки улучшений
    window.handleUpgrade = function(type) {
        const costs = {
            tap: Math.floor(500 * Math.pow(1.5, gameState.clickLvl - 1)),
            autoclick: Math.floor(2000 * Math.pow(1.5, gameState.botLvl))
        };

        const currentCost = type === 'tap' ? costs.tap : costs.autoclick;

        if (gameState.score >= currentCost) {
            gameState.score -= currentCost;
            if (type === 'tap') gameState.clickLvl++;
            else gameState.botLvl++;
            
            updateUI();
            autoSave(); // Сразу сохраняем покупку
            if (tg) tg.HapticFeedback.notificationOccurred('success');
        } else {
            if (tg) tg.showAlert("Недостаточно NP!");
        }
    };

    // Активация ракеты
    window.activateRocket = function() {
        if (gameState.score >= 1000 && !gameState.rocketActive) {
            gameState.score -= 1000;
            gameState.rocketActive = true;
            window.closeModals();
            
            const timerEl = document.getElementById('rocket-timer');
            const timeVal = document.getElementById('rocket-time');
            if (timerEl) timerEl.style.display = 'block';

            let timeLeft = 30;
            const interval = setInterval(() => {
                timeLeft--;
                if (timeVal) timeVal.textContent = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    gameState.rocketActive = false;
                    if (timerEl) timerEl.style.display = 'none';
                }
            }, 1000);
            updateUI();
        }
    };

    function gameLoop() {
        if (gameState.energy < gameState.maxEnergy) {
            gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + 2);
        }
        if (gameState.botLvl > 0) {
            gameState.score += (gameState.botLvl * 0.5);
        }
        updateUI();
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
        } catch (e) { console.error("Ошибка автосохранения"); }
    }

    async function updateJackpotDisplay() {
        try {
            const res = await fetch(`${API_BASE}/api/jackpot`);
            const result = await res.json();
            if (result.status === 'ok') {
                const el = document.getElementById('jackpot-amount');
                if (el) el.innerText = result.data.amount.toLocaleString();
            }
        } catch (e) { }
    }

    window.openModal = function(id) {
        document.getElementById('overlay').classList.add('active');
        document.getElementById('modal-' + id).classList.add('active');
        if(id === 'friends') {
            document.getElementById('referral-link').textContent = `https://t.me/UltraMind_AI_bot?start=${gameState.userId}`;
        }
    };

    window.closeModals = function() {
        document.getElementById('overlay').classList.remove('active');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    };

    window.shareRef = function() {
        const url = `https://t.me/share/url?url=https://t.me/UltraMind_AI_bot?start=${gameState.userId}&text=Присоединяйся к Neural Pulse AI!`;
        if (tg) tg.openTelegramLink(url);
    };

    window.handleDailyClaim = function() {
        gameState.score += 500;
        updateUI();
        window.closeModals();
        if (tg) tg.showPopup({ message: "Вы получили 500 NP!" });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    const coin = document.getElementById('btn');
    if (coin) {
        coin.addEventListener('touchstart', handleMainClick);
    }
})();
}
