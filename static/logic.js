const logic = {
    user: {
        userId: 0,
        balance: 0,
        energy: 1000,
        max_energy: 1000,
        tap_val: 1,
        profit: 0,
        level: 1,
        ref_count: 0,
        username: "Agent"
    },

    init() {
        this.syncWithDB().then(() => {
            this.startPassiveIncome();
            this.setupListeners();
            // Инициализируем интерфейс ПОСЛЕ загрузки данных
            if (window.ui) ui.init(); 
        });
        console.log("Neural Pulse Core v3.8.0 Stable Fully Loaded");
    },

    // Слушатели событий
    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            // Используем pointerdown для быстрой реакции на мобилках
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.tap(e);
            });
        }
    },

    async syncWithDB() {
        // 1. Получаем данные из Telegram WebApp
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tg = window.Telegram.WebApp.initDataUnsafe.user;
            this.user.userId = tg.id;
            this.user.username = tg.first_name || "Agent";
            
            const nameEl = document.getElementById('u-name');
            if (nameEl) nameEl.innerText = this.user.username;
        }

        // 2. Загружаем сохранения с сервера
        try {
            const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
            const res = await fetch(`/api/user/${this.user.userId}?ref=${startParam}`);
            
            if (res.ok) {
                const data = await res.json();
                // Синхронизируем объект пользователя с данными из БД
                this.user.balance = parseFloat(data.balance || 0);
                this.user.energy = parseFloat(data.energy || 1000);
                this.user.max_energy = parseInt(data.max_energy || 1000);
                this.user.tap_val = parseInt(data.click_lvl || 1);
                this.user.profit = parseFloat(data.profit_hr || 0);
                this.user.level = parseInt(data.lvl || 1);
            }
        } catch (e) {
            console.warn("Offline mode or Server Error. Playing locally.");
        }
    },

    async save() {
        if (!this.user.userId || this.user.userId === 0) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    userId: this.user.userId,
                    balance: Math.floor(this.user.balance),
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.tap_val,
                    profit_hr: this.user.profit,
                    lvl: this.user.level
                })
            });
        } catch (e) { console.error("Save failed"); }
    },

    tap(e) {
        if (this.user.energy >= this.user.tap_val) {
            this.user.balance += this.user.tap_val;
            this.user.energy -= this.user.tap_val;
            
            this.showClickAnim(e);
            if (window.ui) ui.update();
            this.checkLevelUp();

            // Вибрация
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        }
    },

    startPassiveIncome() {
        // Регенерация энергии (+1 в сек)
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                if (window.ui) ui.update();
            }
        }, 1000);

        // Пассивный доход
        setInterval(() => {
            if (this.user.profit > 0) {
                // Начисляем долю дохода за 1 секунду
                const perSec = this.user.profit / 3600;
                this.user.balance += perSec;
                if (window.ui) ui.update();
            }
        }, 1000);

        // Автосохранение каждые 20 сек
        setInterval(() => this.save(), 20000);
    },

    checkLevelUp() {
        // Порог: 500 млн за каждый уровень (можно уменьшить для тестов)
        const nextLvlThreshold = this.user.level * 500000000; 
        if (this.user.balance >= nextLvlThreshold) {
            this.user.level++;
            if (window.Telegram?.WebApp) {
                Telegram.WebApp.showAlert(`Система обновлена! Ваш новый уровень: ${this.user.level}`);
            }
            if (window.ui) ui.update();
        }
    },

    showClickAnim(e) {
        // Координаты для анимации "+X"
        const x = e.clientX || (e.touches ? e.touches[0].clientX : window.innerWidth / 2);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : window.innerHeight / 2);
        
        const el = document.createElement('div');
        el.className = 'tap-pop'; 
        el.innerText = `+${this.user.tap_val}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.position = 'absolute';
        el.style.color = '#00ffff';
        el.style.fontWeight = 'bold';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '9999';
        
        document.body.appendChild(el);
        
        // Удаление элемента после завершения анимации (CSS animation 'pop')
        setTimeout(() => el.remove(), 800);
    }
};

// Запуск при загрузке страницы
window.onload = () => logic.init();
