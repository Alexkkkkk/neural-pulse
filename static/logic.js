const logic = {
    user: {
        userId: 0, 
        balance: 0, 
        energy: 1000, 
        max_energy: 1000,
        click_lvl: 1, 
        profit_hr: 0, 
        lvl: 1, 
        username: "Agent",
        isLiked: false, 
        likes: 0
    },

    async init() {
        console.log("🚀 Logic initialization...");
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();
            const tgUser = tg.initDataUnsafe?.user;
            if (tgUser) {
                this.user.userId = tgUser.id.toString();
                this.user.username = tgUser.first_name || "Agent";
                const uNameEl = document.getElementById('u-name');
                if (uNameEl) uNameEl.innerText = this.user.username;
            }
        }

        if (!this.user.userId) this.user.userId = "test_user_local";

        await this.syncWithDB();
        this.setupListeners();
        this.startPassiveIncome();
        
        if (window.ui && typeof ui.init === 'function') {
            ui.init();
        }
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            // touch-action: none предотвращает зум и скролл при тапе
            target.style.touchAction = 'none';
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault(); 
                this.tap(e);
            }, { passive: false });
        }
    },

    async syncWithDB() {
        try {
            const res = await fetch(`/api/user/${this.user.userId}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = parseFloat(data.balance) || 0;
                this.user.energy = parseInt(data.energy) || 1000;
                this.user.max_energy = parseInt(data.max_energy) || 1000;
                this.user.click_lvl = parseInt(data.click_lvl) || 1;
                this.user.profit_hr = parseFloat(data.profit_hr) || 0;
                this.user.lvl = parseInt(data.lvl) || 1;
                this.user.isLiked = data.is_liked || false;
                this.user.likes = parseInt(data.likes) || 0;
                
                if (window.ui) ui.update();
            }
        } catch (e) { console.error("❌ [DB SYNC ERROR]", e); }
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
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }
    },

    async buyUpgrade(type, cost, val) {
        if (this.user.balance < cost) return false;
        
        this.user.balance -= cost;
        if (type === 'tap') this.user.click_lvl += val;
        if (type === 'energy') {
            this.user.max_energy += val;
            this.user.energy += val;
        }
        if (type === 'profit') this.user.profit_hr += val;
        
        if (window.ui) ui.update();
        await this.save();
        return true;
    },

    startPassiveIncome() {
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                if (window.ui) ui.update();
            }
        }, 1500);

        setInterval(() => {
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
                if (window.ui) ui.update();
            }
        }, 1000);

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
                    profit_hr: Math.floor(this.user.profit_hr),
                    lvl: this.user.lvl,
                    is_liked: this.user.isLiked,
                    likes: this.user.likes
                })
            });
        } catch (e) { console.error("❌ [SAVE ERROR]", e); }
    }
};

window.addEventListener('load', () => {
    logic.init();
});
