const logic = {
    user: {
        userId: 0, balance: 0, energy: 1000, max_energy: 1000,
        click_lvl: 1, profit: 0, level: 1, username: "Agent"
    },

    async init() {
        // 1. Сначала берем ID из Telegram
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tg = window.Telegram.WebApp.initDataUnsafe.user;
            this.user.userId = tg.id;
            this.user.username = tg.first_name || "Agent";
        }

        // 2. Только потом идем в базу
        await this.syncWithDB();
        
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
        if (!this.user.userId) return; 

        try {
            const ref = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
            const res = await fetch(`/api/user/${this.user.userId}?ref=${ref}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = parseFloat(data.balance) || 0;
                this.user.energy = parseFloat(data.energy) || 1000;
                this.user.max_energy = parseInt(data.max_energy) || 1000;
                this.user.click_lvl = parseInt(data.click_lvl) || 1;
                this.user.profit = parseFloat(data.profit_hr) || 0;
                this.user.level = parseInt(data.lvl) || 1;
                console.log("✅ Data synced with DB");
            }
        } catch (e) { console.error("Sync error:", e); }
    },

    tap(e) {
        // Проверка: тапаем только если данные загружены и есть энергия
        if (this.user.userId && this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            if (window.ui) {
                ui.update();
                ui.anim(e);
            }
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        } else if (!this.user.userId) {
            console.warn("Tap blocked: No User ID");
        }
    },

    startPassiveIncome() {
        setInterval(() => {
            let changed = false;
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                changed = true;
            }
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
                changed = true;
            }
            if (changed && window.ui) ui.update();
        }, 1000);

        setInterval(() => this.save(), 15000);
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
        } catch (e) { console.error("Save failed"); }
    }
};
