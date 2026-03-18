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
        console.log("🚀 Logic: Инициализация...");
        
        // Интеграция с Telegram WebApp
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();
            
            const tgUser = tg.initDataUnsafe?.user;
            if (tgUser) {
                this.user.userId = tgUser.id.toString();
                this.user.username = tgUser.first_name || "Agent";
                const nameElem = document.getElementById('u-name');
                if (nameElem) nameElem.innerText = this.user.username;
            }
        }

        if (!this.user.userId) this.user.userId = "test_user"; 

        // Сначала загружаем данные, потом вешаем слушатели
        await this.syncWithDB();
        this.setupListeners();
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            // Используем pointerdown для мгновенной реакции без задержек
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (this.user.energy >= this.user.click_lvl) {
                    this.tap(e);
                } else {
                    if (window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
                    }
                }
            });
        }
    },

    async syncWithDB() {
        try {
            const res = await fetch(`/api/user/${this.user.userId}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = Number(data.balance) || 0;
                this.user.energy = Number(data.energy) || 1000;
                this.user.max_energy = Number(data.max_energy) || 1000;
                this.user.click_lvl = Number(data.click_lvl) || 1;
                this.user.profit = Number(data.profit_hr) || 0;
                this.user.level = Number(data.lvl) || 1;
                
                if (window.ui) ui.update();
            }
        } catch (e) { console.error("❌ Sync Error:", e); }
    },

    tap(e) {
        this.user.balance += this.user.click_lvl;
        this.user.energy -= this.user.click_lvl;
        
        if (window.ui) {
            ui.update();
            ui.anim(e); // Анимация вылетающих цифр
        }
        
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
    },

    startPassiveIncome() {
        // Доход и регенерация энергии раз в секунду
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.energy + 1, this.user.max_energy);
            }
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
            }
            if (window.ui) ui.update();
        }, 1000);

        // Автосохранение каждые 10 секунд
        setInterval(() => this.save(), 10000);
    },

    async save() {
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
                    profit_hr: this.user.profit,
                    lvl: this.user.level
                })
            });
        } catch (e) { console.error("❌ Save error"); }
    }
};

// Важно: Инициализацию вызывает loading.js, здесь просто объявляем
window.logic = logic;
