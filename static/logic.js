const logic = {
    user: null,
    tonConnectUI: null,

    async init() {
        if (typeof TON_CONNECT_UI !== 'undefined') {
            this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
                buttonRootId: 'ton-connect-btn'
            });
            this.tonConnectUI.onStatusChange(wallet => {
                if (wallet) this.saveWallet(wallet.account.address);
            });
        }

        const tg = window.Telegram?.WebApp;
        tg?.expand();
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        
        try {
            const res = await fetch(`/api/user/${userId}`);
            const rawData = await res.json();
            
            this.user = {
                ...rawData,
                user_id: String(userId),
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy || 0),
                max_energy: Number(rawData.max_energy || 1000),
                click_lvl: Number(rawData.click_lvl || 1),
                profit_hr: Number(rawData.profit_hr || 0),
                lvl: Number(rawData.lvl || 1),
                last_seen: rawData.last_seen
            };

            this.calculateOfflineIncome();
            this.startLoops();
            return true; 
        } catch (e) { 
            console.error("Load Error:", e);
            return false;
        }
    },

    calculateOfflineIncome() {
        if (!this.user.last_seen || this.user.profit_hr <= 0) return;
        const now = new Date();
        const lastSeen = new Date(this.user.last_seen);
        const secondsOffline = Math.floor((now - lastSeen) / 1000);
        
        // Ограничение офлайн дохода 3 часами (10800 сек)
        const cappedSeconds = Math.min(secondsOffline, 10800);
        const income = (this.user.profit_hr / 3600) * cappedSeconds;
        
        if (income > 0) {
            this.user.balance += income;
            console.log(`Офлайн доход: +${Math.floor(income)}`);
        }
    },

    tap() {
        if (this.user && this.user.energy >= 1) {
            this.user.balance = Number(this.user.balance) + Number(this.user.click_lvl);
            this.user.energy -= 1;
            ui.update();
            ui.anim(window.event);
        }
    },

    startLoops() {
        // Сохранение раз в 10 сек
        setInterval(() => this.save(), 10000);
        
        // Ежесекундное обновление: энергия и прибыль
        setInterval(() => {
            if (!this.user) return;
            
            // Регенерация энергии (3 единицы в сек)
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 3);
            }
            
            // Пассивный доход
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            ui.update();
        }, 1000);
    },

    async saveWallet(address) {
        if (!this.user) return;
        try {
            await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.user.user_id, address })
            });
        } catch (e) { console.error("Wallet save error"); }
    },

    async save() {
        if (!this.user) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.user_id,
                    balance: this.user.balance,
                    energy: this.user.energy,
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: this.user.profit_hr,
                    lvl: this.user.lvl,
                    likes: this.user.likes || 0,
                    is_liked: this.user.is_liked || false
                })
            });
        } catch(e) { console.log("Save failed"); }
    }
};
