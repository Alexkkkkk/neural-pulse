const logic = {
    user: {
        userId: 0, balance: 0, energy: 1000, max_energy: 1000,
        click_lvl: 1, profit: 0, level: 1, username: "Agent"
    },

    async init() {
        // 1. Получаем данные из Telegram ПЕРЕД синхронизацией
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tg = window.Telegram.WebApp.initDataUnsafe.user;
            this.user.userId = tg.id;
            this.user.username = tg.first_name || "Agent";
        }

        // 2. Ждем синхронизации с БД
        await this.syncWithDB();
        
        // 3. Запускаем процессы
        this.startPassiveIncome();
        this.setupListeners();
        
        if (window.ui) ui.init(); 
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.tap(e);
            });
        }
    },

    async syncWithDB() {
        // Если ID все еще 0 (например, открыли не в телеграм), не делаем запрос
        if (!this.user.userId) {
            console.warn("User ID is 0, skipping sync");
            return;
        }

        try {
            const ref = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
            const res = await fetch(`/api/user/${this.user.userId}?ref=${ref}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = parseFloat(data.balance) || 0;
                this.user.energy = parseInt(data.energy) || 1000;
                this.user.max_energy = parseInt(data.max_energy) || 1000;
                this.user.click_lvl = parseInt(data.click_lvl) || 1;
                this.user.profit = parseFloat(data.profit_hr) || 0;
                this.user.level = parseInt(data.lvl) || 1;
                console.log("✅ Sync complete");
            }
        } catch (e) { console.error("Database Sync Error:", e); }
    },

    async save() {
        if (!this.user.userId) return;
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
        } catch (e) { console.warn("Auto-save failed"); }
    },

    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            this.checkLevel();
            if (window.ui) {
                ui.update();
                ui.anim(e);
            }
            if (window.Telegram?.WebApp?.HapticFeedback) 
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    },

    checkLevel() {
        const nextLvlThreshold = this.user.level * 100000;
        if (this.user.balance >= nextLvlThreshold) {
            this.user.level++;
            if (window.Telegram?.WebApp) Telegram.WebApp.showAlert(`SYSTEM UPGRADE: Level ${this.user.level}`);
        }
    },

    startPassiveIncome() {
        setInterval(() => {
            let needsUpdate = false;
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                needsUpdate = true;
            }
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
                needsUpdate = true;
            }
            if (needsUpdate && window.ui) ui.update();
        }, 1000);

        setInterval(() => this.save(), 15000);
    }
};
