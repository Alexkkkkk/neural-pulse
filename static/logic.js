const logic = {
    user: {
        userId: 0, balance: 0, energy: 1000, max_energy: 1000,
        click_lvl: 1, profit: 0, level: 1, username: "Agent"
    },

    async init() {
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
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tg = window.Telegram.WebApp.initDataUnsafe.user;
            this.user.userId = tg.id;
            this.user.username = tg.first_name || "Agent";
        }
        try {
            const ref = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
            const res = await fetch(`/api/user/${this.user.userId}?ref=${ref}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = data.balance;
                this.user.energy = data.energy;
                this.user.max_energy = data.max_energy;
                this.user.click_lvl = data.click_lvl;
                this.user.profit = data.profit_hr;
                this.user.level = data.lvl;
            }
        } catch (e) { console.warn("Sync Error"); }
    },

    async save() {
        if (!this.user.userId) return;
        await fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                userId: this.user.userId,
                balance: this.user.balance,
                energy: this.user.energy,
                max_energy: this.user.max_energy,
                click_lvl: this.user.click_lvl,
                profit_hr: this.user.profit,
                lvl: this.user.level
            })
        });
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
        const nextLvl = this.user.level * 100000;
        if (this.user.balance >= nextLvl) {
            this.user.level++;
            if (window.Telegram?.WebApp) Telegram.WebApp.showAlert(`Level Up! Текущий уровень: ${this.user.level}`);
        }
    },

    startPassiveIncome() {
        setInterval(() => {
            let update = false;
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                update = true;
            }
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
                update = true;
            }
            if (update && window.ui) ui.update();
        }, 1000);
        setInterval(() => this.save(), 15000);
    }
};
