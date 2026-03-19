const logic = {
    user: null,
    tonConnectUI: null,

    async init() {
        console.log("📡 Logic initializing...");
        const tg = window.Telegram?.WebApp;
        tg?.expand();
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        
        try {
            // Загрузка данных
            const res = await fetch(`/api/user/${userId}`);
            if (!res.ok) throw new Error("Server down");
            const rawData = await res.json();
            
            this.user = {
                ...rawData,
                user_id: String(userId),
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy || 0),
                max_energy: Number(rawData.max_energy || 1000),
                click_lvl: Number(rawData.click_lvl || 1),
                profit_hr: Number(rawData.profit_hr || 0),
                lvl: Number(rawData.lvl || 1)
            };

            // Инициализация TON Connect
            if (typeof TON_CONNECT_UI !== 'undefined') {
                this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                    manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-btn'
                });
                this.tonConnectUI.onStatusChange(wallet => {
                    if (wallet) this.saveWallet(wallet.account.address);
                });
            }

            this.calculateOffline(); // Считаем доход за время отсутствия
            this.startLoops();      // Запускаем таймеры
            return true; 
        } catch (e) { 
            console.error("❌ Logic init error:", e);
            return false;
        }
    },

    calculateOffline() {
        if (this.user.last_seen && this.user.profit_hr > 0) {
            const now = new Date();
            const last = new Date(this.user.last_seen);
            const diff = Math.floor((now - last) / 1000); // в секундах
            const cappedDiff = Math.min(diff, 10800); // максимум за 3 часа
            const income = (this.user.profit_hr / 3600) * cappedDiff;
            this.user.balance += income;
            console.log(`💰 Offline income: +${income.toFixed(2)}`);
        }
    },

    tap() {
        if (this.user && this.user.energy >= 1) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= 1;
            ui.update();
            ui.anim(window.event);
        }
    },

    startLoops() {
        // Цикл 1: Энергия и пассивный доход (1 раз в сек)
        setInterval(() => {
            if (!this.user) return;
            // Регенерация
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
            }
            // Доход
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            ui.update();
        }, 1000);

        // Цикл 2: Сохранение в БД (раз в 10 сек)
        setInterval(() => this.save(), 10000);
    },

    async saveWallet(address) {
        if (!this.user) return;
        try {
            await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.user.user_id, address })
            });
            this.user.wallet = address;
        } catch (e) { console.error("Wallet sync fail"); }
    },

    async save() {
        if (!this.user || !this.user.user_id) return;
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
                    likes: this.user.likes,
                    is_liked: this.user.is_liked
                })
            });
            console.log("💾 Progress saved");
        } catch(e) { console.log("Cloud save fail"); }
    }
};
