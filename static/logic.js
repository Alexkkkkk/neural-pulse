const logic = {
    user: null,
    tonConnectUI: null,

    async init() {
        console.log("🚀 Logic: Initializing...");
        const tg = window.Telegram?.WebApp;
        
        if (tg) {
            tg.ready();
            tg.expand();
            // Включаем подтверждение закрытия, чтобы игрок случайно не вышел
            tg.enableClosingConfirmation();
        }

        // Получаем данные пользователя из Telegram
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const firstName = tg?.initDataUnsafe?.user?.first_name || "Agent";
        const photoUrl = tg?.initDataUnsafe?.user?.photo_url || "logo.png";
        
        // Установка имени в интерфейсе
        const nameEl = document.getElementById('u-name');
        if (nameEl) nameEl.innerText = firstName;

        try {
            const res = await fetch(`/api/user/${userId}`);
            if (!res.ok) throw new Error("API Connection Failed");
            const rawData = await res.json();
            
            // Маппинг данных из БД с защитой от пустых значений
            this.user = {
                user_id: String(userId),
                username: firstName, 
                photo_url: photoUrl, 
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy !== undefined ? rawData.energy : 1000),
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
            ui.init(); // Инициализируем UI только после загрузки данных
            return true; 
        } catch (e) {
            console.error("❌ Logic Error:", e);
            return false;
        }
    },

    tap(e) {
        if (!this.user || this.user.energy < 1) return;

        this.user.balance += this.user.click_lvl;
        this.user.energy -= 1;
        
        // Расчет уровня: +1 за каждые 10 000 баланса
        this.user.lvl = Math.floor(this.user.balance / 10000) + 1;
        
        ui.update();
        ui.anim(e);
    },

    startLoops() {
        // Регенерация энергии и пассивный доход каждые 1 сек
        setInterval(() => {
            if (!this.user) return;
            
            // Реген
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
            }
            
            // Доход
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            
            ui.update();
        }, 1000);

        // Сохранение в БД каждые 10 секунд
        setInterval(() => this.save(), 10000);
    },

    async save() {
        if (!this.user) return;
        try {
            const payload = {
                userId: this.user.user_id,
                username: this.user.username,
                photo_url: this.user.photo_url,
                balance: this.user.balance,
                energy: Math.floor(this.user.energy),
                max_energy: this.user.max_energy,
                click_lvl: this.user.click_lvl,
                profit_hr: this.user.profit_hr,
                lvl: this.user.lvl
            };

            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) console.log("💾 Progress synced");
        } catch (e) { 
            console.warn("📡 Sync lost: progress not saved"); 
        }
    }
};
