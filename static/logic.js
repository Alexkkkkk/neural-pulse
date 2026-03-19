const logic = {
    user: null,
    tonConnectUI: null,

    async init() {
        // Инициализация TON Connect
        this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
            buttonRootId: 'ton-connect-btn'
        });

        // Слушаем изменения статуса кошелька
        this.tonConnectUI.onStatusChange(wallet => {
            if (wallet) {
                this.saveWallet(wallet.account.address);
            }
        });

        const tg = window.Telegram?.WebApp;
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        
        try {
            const res = await fetch(`/api/user/${userId}`);
            const rawData = await res.json();
            
            // Преобразуем всё в числа при загрузке
            this.user = {
                ...rawData,
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy || 0),
                max_energy: Number(rawData.max_energy || 1000),
                click_lvl: Number(rawData.click_lvl || 1),
                profit_hr: Number(rawData.profit_hr || 0),
                lvl: Number(rawData.lvl || 1)
            };
            
            if (typeof ui !== 'undefined') ui.init();
            this.startLoops();
        } catch (e) { console.error("Load Error:", e); }
    },

    async saveWallet(address) {
        if (!this.user || this.user.wallet === address) return;
        try {
            await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.user.user_id, address: address })
            });
            this.user.wallet = address;
            console.log("✅ Wallet saved:", address);
        } catch (e) { console.error("Wallet Save Error:", e); }
    },

    tap() {
        if (this.user && this.user.energy >= 1) {
            // Математическое сложение (без ошибок "111")
            this.user.balance = Number(this.user.balance) + Number(this.user.click_lvl);
            this.user.energy -= 1;
            ui.update();
            ui.anim(window.event);
        }
    },

    startLoops() {
        setInterval(() => this.save(), 10000);
        setInterval(() => {
            if (!this.user) return;
            if (this.user.energy < this.user.max_energy) this.user.energy += 1;
            if (this.user.profit_hr > 0) {
                this.user.balance = Number(this.user.balance) + (Number(this.user.profit_hr) / 3600);
            }
            ui.update();
        }, 1000);
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
                    lvl: this.user.lvl
                })
            });
        } catch(e) { console.log("Save Error"); }
    }
};

window.onload = () => logic.init();
