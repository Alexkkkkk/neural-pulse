const logic = {
    user: {
        userId: 0,
        balance: 0,
        energy: 1000,
        max_energy: 1000,
        click_lvl: 1,
        profit: 0,
        level: 1,
        username: "Agent",
        isLiked: false,
        likes: 0
    },

    async init() {
        console.log("🚀 Logic: Syncing...");
        
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();
            
            const tgUser = tg.initDataUnsafe?.user;
            if (tgUser) {
                this.user.userId = tgUser.id.toString();
                this.user.username = tgUser.first_name || "Agent";
            }
        }

        if (!this.user.userId || this.user.userId === 0) {
            this.user.userId = "test_user_123"; 
        }

        await this.syncWithDB();
        this.setupListeners();
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            // Используем pointerdown для мгновенного отклика
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.tap(e);
            });
        }
    },

    async syncWithDB() {
        try {
            const res = await fetch(`/api/user/${this.user.userId}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = parseFloat(data.balance);
                this.user.energy = parseInt(data.energy);
                this.user.max_energy = parseInt(data.max_energy);
                this.user.click_lvl = parseInt(data.click_lvl);
                this.user.profit = parseFloat(data.profit_hr);
                this.user.level = parseInt(data.lvl);
                this.user.isLiked = data.is_liked;
                this.user.likes = parseInt(data.likes);
                
                if (window.ui) ui.update();
            }
        } catch (e) { console.error("❌ DB Sync Error:", e); }
    },

    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            // Локальное обновление для скорости
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            if (window.ui) {
                ui.update();
                ui.anim(e); // Вылетающие цифры
            }

            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        } else {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
            }
        }
    },

    toggleLike() {
        this.user.isLiked = !this.user.isLiked;
        this.user.likes += this.user.isLiked ? 1 : -1;
        if (window.ui) ui.update();
        this.save();
    },

    async buyUpgrade(type, cost, val) {
        if (this.user.balance >= cost) {
            this.user.balance -= cost;
            if (type === 'tap') this.user.click_lvl += val;
            if (type === 'energy') this.user.max_energy += val;
            if (type === 'profit') this.user.profit += val;
            
            if (window.ui) ui.update();
            await this.save();
            return true;
        }
        return false;
    },

    startPassiveIncome() {
        // Энергия +1 в секунду
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                if (window.ui) ui.update();
            }
        }, 1000);

        // Пассивный доход
        setInterval(() => {
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
                if (window.ui) ui.update();
            }
        }, 1000);

        // Автосохранение раз в 10 секунд
        setInterval(() => this.save(), 10000);
    },

    async save() {
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.userId,
                    balance: this.user.balance,
                    energy: this.user.energy,
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: this.user.profit,
                    lvl: this.user.level,
                    is_liked: this.user.isLiked,
                    likes: this.user.likes
                })
            });
        } catch (e) { console.error("❌ Save Error:", e); }
    }
};
