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
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
            if (tgUser) {
                this.user.userId = tgUser.id;
                this.user.username = tgUser.first_name || "Agent";
            }
        }
        await this.syncWithDB();
        this.setupListeners();
        if (window.ui) ui.init();
        this.startPassiveIncome();
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
            const res = await fetch(`/api/user/${this.user.userId}?v=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                Object.assign(this.user, {
                    balance: Number(data.balance) || 0,
                    energy: Number(data.energy) || 1000,
                    max_energy: Number(data.max_energy) || 1000,
                    click_lvl: Number(data.click_lvl) || 1,
                    profit: Number(data.profit_hr) || 0,
                    level: Number(data.lvl) || 1
                });
            }
        } catch (e) { console.error("DB Sync Error"); }
    },

    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            if (window.ui) { ui.update(); ui.anim(e); }
            window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
        }
    },

    async save() {
        if (!this.user.userId) return;
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
        } catch (e) { console.error("Save Error"); }
    },

    startPassiveIncome() {
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) this.user.energy++;
            if (this.user.profit > 0) this.user.balance += (this.user.profit / 3600);
            if (window.ui) ui.update();
        }, 1000);
        setInterval(() => this.save(), 15000);
    }
};
