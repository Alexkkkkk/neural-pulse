if (typeof window !== 'undefined') {
(function() {
    const API_BASE = window.location.origin;
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
        setInterval(autoSave, 20000);
        setInterval(gameLoop, 1000);
    }

    // Загрузка данных с сервера
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
        } catch (e) { console.error("Ошибка загрузки:", e); }
    }

    // Обновление интерфейса (Лиги, Энергия, Текст)
    function updateUI() {
        const scoreEl = document.getElementById('score');
        const energyStat = document.getElementById('energy-stat');
        const energyFill = document.getElementById('energy-fill');
        const leagueName = document.getElementById('league-name');
        const leagueFill = document.getElementById('league-fill');

        if (scoreEl) scoreEl.innerText = Math.floor(gameState.score).toLocaleString();
        if (energyStat) energyStat.textContent = `${Math.floor(gameState.energy)}/${gameState.maxEnergy}`;
        if (energyFill) energyFill.style.width = (gameState.energy / gameState.maxEnergy * 100) + '%';

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

    // Клик по кнопке (Монета)
    function handleMainClick(e) {
        e.preventDefault();
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        
        let power = gameState.rocketActive ? gameState.clickLvl * 5 : gameState.clickLvl;
        
        if (gameState.rocketActive || gameState.energy >= gameState.clickLvl) {
            if (!gameState.rocketActive) gameState.energy -= 1;
            gameState.score += power;
            
            spawnPlus(touch.pageX, touch.pageY, power);
            updateUI();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
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

    // Ежесекундный цикл (Реген энергии и Автобот)
    function gameLoop() {
        if (gameState.energy < gameState.maxEnergy) {
            gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + 2);
        }
        if (gameState.botLvl > 0) {
            gameState.score += (gameState.botLvl * 0.5);
        }
        updateUI();
    }

    // Сохранение на сервер
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

    // Управление модалками
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

    // Слушатели событий
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    const coin = document.getElementById('btn');
    if (coin) {
        coin.addEventListener('touchstart', handleMainClick);
    }
})();
}
