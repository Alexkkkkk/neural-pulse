
(function() {
    // 1. КОНФИГУРАЦИЯ
    const API_BASE = window.location.origin.includes('bothost.ru') 
        ? window.location.origin 
        : "https://np.bothost.ru";

    const tg = window.Telegram?.WebApp;

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

    // 2. ИНИЦИАЛИЗАЦИЯ
    async function init() {
        if (tg) {
            tg.expand();
            tg.ready();
            gameState.userId = tg.initDataUnsafe?.user?.id?.toString() || "123456789";
        } else {
            gameState.userId = "123456789";
        }
        
        const displayId = document.getElementById('user-id-display');
        if (displayId) displayId.textContent = "ID: " + gameState.userId;

        await loadBalance();
        
        // Показываем интерфейс
        const gameEl = document.getElementById('game');
        if (gameEl) gameEl.style.opacity = '1';

        // Запуск циклов
        setInterval(updateJackpotDisplay, 10000);
        setInterval(autoSave, 20000); 
        setInterval(gameLoop, 1000);

        // Навешиваем клик
        const coin = document.getElementById('btn');
        if (coin) {
            // Используем touchstart для мгновенного отклика на мобилках
            coin.addEventListener('touchstart', handleMainClick, { passive: false });
            // Для тестов на ПК
            coin.addEventListener('click', handleMainClick);
        }
    }

    async function loadBalance() {
        try {
            const res = await fetch(`${API_BASE}/api/balance/${gameState.userId}`);
            const result = await res.json();
            if (result.status === 'ok') {
                gameState.score = result.data.balance || 0;
                gameState.clickLvl = result.data.click_lvl || 1;
                gameState.botLvl = result.data.bot_lvl || 0;
                updateUI();
            }
        } catch (e) { console.error("Ошибка загрузки баланса:", e); }
    }

    function updateUI() {
        const elements = {
            score: document.getElementById('score'),
            energyStat: document.getElementById('energy-stat'),
            energyFill: document.getElementById('energy-fill'),
            leagueName: document.getElementById('league-name'),
            leagueFill: document.getElementById('league-fill'),
            tapLvl: document.getElementById('tap-lvl-val'),
            autoLvl: document.getElementById('auto-lvl-val')
        };

        if (elements.score) elements.score.innerText = Math.floor(gameState.score).toLocaleString();
        if (elements.energyStat) elements.energyStat.textContent = `${Math.floor(gameState.energy)}/${gameState.maxEnergy}`;
        if (elements.energyFill) elements.energyFill.style.width = (gameState.energy / gameState.maxEnergy * 100) + '%';
        if (elements.tapLvl) elements.tapLvl.textContent = gameState.clickLvl;
        if (elements.autoLvl) elements.autoLvl.textContent = gameState.botLvl;

        // Лиги
        let current = LEAGUES[0], next = LEAGUES[1];
        for (let i = 0; i < LEAGUES.length; i++) {
            if (gameState.score >= LEAGUES[i].min) {
                current = LEAGUES[i];
                next = LEAGUES[i+1] || null;
            }
        }

        if (elements.leagueName) {
            elements.leagueName.textContent = current.name + " LEAGUE";
            elements.leagueName.style.color = current.color;
        }
        if (elements.leagueFill) {
            elements.leagueFill.style.background = current.color;
            if (next) {
                let prog = ((gameState.score - current.min) / (next.min - current.min)) * 100;
                elements.leagueFill.style.width = Math.min(100, prog) + '%';
            } else {
                elements.leagueFill.style.width = '100%';
            }
        }
    }

    function handleMainClick(e) {
        if (e.type === 'touchstart') e.preventDefault(); // Убираем дублирование клика
        
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        let power = gameState.rocketActive ? gameState.clickLvl * 5 : gameState.clickLvl;
        
        if (gameState.rocketActive || gameState.energy >= 1) {
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
        p.style.position = 'absolute';
        p.style.left = x + 'px'; p.style.top = y + 'px';
        p.style.pointerEvents = 'none';
        p.textContent = `+${val}`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 700);
    }

    // Глобальные функции для кнопок HTML
    window.handleUpgrade = function(type) {
        const cost = type === 'tap' 
            ? Math.floor(500 * Math.pow(1.5, gameState.clickLvl - 1))
            : Math.floor(2000 * Math.pow(1.5, gameState.botLvl));

        if (gameState.score >= cost) {
            gameState.score -= cost;
            if (type === 'tap') gameState.clickLvl++;
            else gameState.botLvl++;
            updateUI();
            autoSave();
            if (tg) tg.HapticFeedback.notificationOccurred('success');
        } else {
            if (tg) tg.showAlert("Недостаточно NP!");
        }
    };

    async function autoSave() {
        if (!gameState.userId) return;
        try {
            await fetch(`${API_BASE}/api/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: gameState.userId, // Передаем как строку
                    score: Math.floor(gameState.score),
                    click_lvl: gameState.clickLvl,
                    bot_lvl: gameState.botLvl
                })
            });
        } catch (e) { console.error("Ошибка сохранения"); }
    }

    function gameLoop() {
        if (gameState.energy < gameState.maxEnergy) {
            gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + 1);
        }
        if (gameState.botLvl > 0) {
            gameState.score += (gameState.botLvl * 0.1); // Сбалансированный автокликер
        }
        updateUI();
    }

    async function updateJackpotDisplay() {
        try {
            const res = await fetch(`${API_BASE}/api/jackpot`);
            const result = await res.json();
            const el = document.getElementById('jackpot-amount');
            if (result.status === 'ok' && el) el.innerText = result.data.amount.toLocaleString();
        } catch (e) { }
    }

    // Модалки
    window.openModal = function(id) {
        const overlay = document.getElementById('overlay');
        const modal = document.getElementById('modal-' + id);
        if (overlay) overlay.classList.add('active');
        if (modal) modal.classList.add('active');
        if(id === 'friends') {
            const ref = document.getElementById('referral-link');
            if (ref) ref.textContent = `https://t.me/neural_pulse_bot?start=${gameState.userId}`;
        }
    };

    window.closeModals = function() {
        const overlay = document.getElementById('overlay');
        if (overlay) overlay.classList.remove('active');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    };

    // Старт
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

})();
