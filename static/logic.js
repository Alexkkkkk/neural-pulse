const logic = {
    user: {
        userId: 0,
        balance: 0,
        energy: 1000,
        max_energy: 1000,
        click_lvl: 1,
        profit: 0,
        level: 1,
        username: "Agent"
    },

    async init() {
        console.log("🚀 Инициализация логики...");
        
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            
            const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
            if (tgUser) {
                this.user.userId = tgUser.id;
                this.user.username = tgUser.first_name || "Agent";
                const nameEl = document.getElementById('u-name');
                if (nameEl) nameEl.innerText = this.user.username;
            } else {
                this.user.userId = "test_user";
            }
        } else {
            this.user.userId = "test_user";
        }

        // Ждем данные из БД
        await this.syncWithDB();
        
        // Включаем кнопку тапа
        this.setupListeners();

        // Обновляем UI после загрузки данных
        if (window.ui) ui.init();
        
        console.log("✅ Логика готова");
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            // pointerdown срабатывает мгновенно, не дожидаясь отпускания пальца
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault(); // Защита от системного зума и скролла
                this.tap(e);
            });
            console.log("🎯 Слушатель тапов активен");
        } else {
            console.error("❌ Элемент #tap-target не найден!");
        }
    },

    async syncWithDB() {
        if (!this.user.userId || this.user.userId === "test_user") return;
        try {
            const res = await fetch(`/api/user/${this.user.userId}?v=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = Number(data.balance) || 0;
                this.user.energy = Number(data.energy) || 1000;
                this.user.max_energy = Number(data.max_energy) || 1000;
                this.user.click_lvl = Number(data.click_lvl) || 1;
                this.user.profit = Number(data.profit_hr) || 0;
                this.user.level = Number(data.lvl) || 1;
            }
        } catch (e) {
            console.error("❌ Ошибка синхронизации с БД");
        }
    },

    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            if (window.ui) {
                ui.update();
                ui.anim(e); // Запуск анимации +1
            }

            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        } else {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
            }
        }
    },

    async buyUpgrade(type, cost, value) {
        if (this.user.balance >= cost) {
            this.user.balance -= cost;
            if (type === 'tap') this.user.click_lvl += value;
            if (type === 'energy') this.user.max_energy += value;
            if (type === 'profit') this.user.profit += value;
            
            if (window.ui) ui.update();
            await this.save();
            return true;
        }
        return false;
    },

    async save() {
        if (!this.user.userId || this.user.userId === "test_user") return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        } catch (e) {
            console.error("💾 Ошибка сохранения данных");
        }
    },

    startPassiveIncome() {
        // Каждую секунду восстанавливаем энергию и капает прибыль
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
            }
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
            }
            if (window.ui) ui.update();
        }, 1000);

        // Автосохранение в БД раз в 15 секунд
        setInterval(() => this.save(), 15000);
    }
};
