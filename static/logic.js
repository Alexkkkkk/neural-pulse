const logic = {
    user: null,
    tonConnectUI: null,

    async init() {
        console.log("⚙️ Logic: Starting...");
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
        }

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
                lvl: Number(rawData.lvl || 1)
            };

            // Инициализация TON
            if (window.TON_CONNECT_UI) {
                this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                    manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-btn'
                });
            }

            this.startLoops();
            return true;
        } catch (e) {
            console.error("⚙️ Logic: Load failed", e);
            return false;
        }
    },

    tap(e) {
        if (!this.user || this.user.energy < 1) return;

        this.user.balance += this.user.click_lvl;
        this.user.energy -= 1;

        if (window.ui && typeof ui.update === 'function') {
            ui.update();
            ui.anim(e);
        }
    },

    startLoops() {
        setInterval(() => {
            if (!this.user) return;
            if (this.user.energy < this.user.max_energy) this.user.energy += 1;
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            if (window.ui) ui.update();
        }, 1000);

        setInterval(() => this.save(), 10000);
    },

    async save() {
        if (!this.user) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.user)
            });
        } catch (e) { console.warn("Save sync lost"); }
    }
};
