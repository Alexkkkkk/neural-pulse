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
        
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();
            tg.disableVerticalSwipes();
            
            const tgUser = tg.initDataUnsafe?.user;
            if (tgUser) {
                this.user.userId = tgUser.id;
                this.user.username = tgUser.first_name || "Agent";
                if (document.getElementById('u-name')) {
                    document.getElementById('u-name').innerText = this.user.username;
                }
            }
        }

        if (!this.user.userId) this.user.userId = "test_user"; 

        await this.syncWithDB();
        this.setupListeners();
        this.startPassiveIncome();
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
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
                if (window.ui) ui.update();
            }
        } catch (e) { console.error("Sync Error"); }
    },

    tap(e) {
        this.user.balance += this.user.click_lvl;
        this.user.energy -= this.user.click_lvl;
        if (window.ui) {
            ui.update();
            ui.anim(e);
        }
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
    },

    startPassiveIncome() {
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) this.user.energy++;
            if (this.user.profit > 0) this.user.balance += (this.user.profit / 3600);
            if (window.ui) ui.update();
        }, 1000);
        setInterval(() => this.save(), 15000);
    },

    async save() {
        fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: this.user.userId,
                balance: Math.floor(this.user.balance),
                energy: Math.floor(this.user.energy),
                max_energy: this.user.max_energy,
                click_lvl: this.user.click_lvl,
                profit_hr: Math.floor(this.user.profit)
            })
        });
    }
};

// Запуск логики сразу при загрузке скрипта
logic.init();
