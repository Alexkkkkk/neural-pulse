const logic = {
    user: null,
    tonConnectUI: null,

    async init() {
        console.log("🚀 Logic: Initializing...");
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            // Подтягиваем имя из Телеграма
            const username = tg.initDataUnsafe?.user?.first_name || "Agent";
            document.getElementById('u-name').innerText = username;
        }

        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        
        try {
            const res = await fetch(`/api/user/${userId}`);
            if (!res.ok) throw new Error("Server error");
            const rawData = await res.json();
            
            this.user = {
                ...rawData,
                user_id: String(userId),
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy || 1000),
                max_energy: Number(rawData.max_energy || 1000),
                click_lvl: Number(rawData.click_lvl || 1),
                profit_hr: Number(rawData.profit_hr || 0),
                lvl: Number(rawData.lvl || 1)
            };

            // Инициализация TON Connect
            if (typeof TonConnectUI !== 'undefined') {
                this.tonConnectUI = new TonConnectUI.TonConnectUI({
                    manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-btn'
                });
            }

            this.startLoops();
            return true; 
        } catch (e) {
            console.error("❌ Logic: Load Error", e);
            return false;
        }
    },

    tap(e) {
        if (!this.user || this.user.energy < 1) return;

        this.user.balance += this.user.click_lvl;
        this.user.energy -= 1;
        
        // Авто-уровень (каждые 10к)
        this.user.lvl = Math.floor(this.user.balance / 10000) + 1;
        
        ui.update();
        ui.anim(e);
    },

    startLoops() {
        setInterval(() => {
            if (!this.user) return;
            // Реген энергии
            if (this.user.energy < this.user.max_energy) this.user.energy += 1;
            // Пассивный доход (делим на 3600 сек)
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            ui.update();
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
            console.log("💾 Progress Sync");
        } catch (e) { console.warn("Save lost"); }
    }
};
