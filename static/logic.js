const logic = {
    user: {
        userId: 0, balance: 0, energy: 1000, max_energy: 1000,
        click_lvl: 1, profit: 0, level: 1, username: "Agent"
    },

    async init() {
        console.log("🚀 Инициализация логики...");
        
        // Инициализация Telegram WebApp
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }

        // Попытка получить ID пользователя
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (tgUser) {
            this.user.userId = tgUser.id;
            this.user.username = tgUser.first_name || "Agent";
            
            const nameEl = document.getElementById('u-name');
            if (nameEl) nameEl.innerText = this.user.username;
        } else {
            console.warn("⚠️ Telegram ID не найден. Используется тестовый режим.");
            this.user.userId = "test_user"; // Для тестов в браузере
        }

        // Загрузка данных из БД
        await this.syncWithDB();
        
        // Запуск процессов
        this.startPassiveIncome();
        this.setupListeners();
        
        // Инициализация интерфейса
        if (window.ui) {
            ui.init();
            ui.update(); 
        }
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            // Используем pointerdown для быстрой реакции на касания
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.tap(e);
            });
        }
    },

    async syncWithDB() {
        if (!this.user.userId || this.user.userId === "test_user") return; 
        try {
            const res = await fetch(`/api/user/${this.user.userId}?v=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = data.balance || 0;
                this.user.energy = data.energy || 1000;
                this.user.max_energy = data.max_energy || 1000;
                this.user.click_lvl = data.click_lvl || 1;
                this.user.profit = data.profit_hr || 0;
                this.user.level = data.lvl || 1;
                console.log("✅ Данные загружены из БД");
            }
        } catch (e) { 
            console.error("❌ Ошибка синхронизации с сервером"); 
        }
    },

    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            if (window.ui) { 
                ui.update(); 
                ui.anim(e); 
            }
            
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        }
    },

    // Функция покупки улучшений (для BOOST и MINE)
    async buyUpgrade(type, cost, value) {
        if (this.user.balance >= cost) {
            this.user.balance -= cost;
            
            if (type === 'tap') this.user.click_lvl += value;
            if (type === 'energy') this.user.max_energy += value;
            if (type === 'profit') this.user.profit += value;
            
            ui.update();
            await this.save(); // Сразу сохраняем покупку
            return true;
        }
        return false;
    },

    async save() {
        if (!this.user.userId || this.user.userId === "test_user") return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    userId: this.user.userId,
                    balance: Math.floor(this.user.balance),
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: Math.floor(this.user.profit),
                    lvl: this.user.level
                })
            });
        } catch (e) { console.error("💾 Ошибка автосохранения"); }
    },

    startPassiveIncome() {
        setInterval(() => {
            // Регенерация энергии
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
            }
            // Пассивный доход
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
            }
            if (window.ui) ui.update();
        }, 1000);
        
        // Автосохранение каждые 15 секунд
        setInterval(() => this.save(), 15000);
    }
};
