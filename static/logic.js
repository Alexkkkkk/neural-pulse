const logic = {
    user: null,
    async init() {
        const tg = window.Telegram?.WebApp;
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const username = tg?.initDataUnsafe?.user?.username || "Agent";

        try {
            const res = await fetch(`/api/user/${userId}`);
            const rawData = await res.json();
            
            // Превращаем строки из БД в числа, чтобы избежать ошибок сложения
            this.user = {
                ...rawData,
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy || 0),
                max_energy: Number(rawData.max_energy || 1000),
                click_lvl: Number(rawData.click_lvl || 1),
                profit_hr: Number(rawData.profit_hr || 0),
                lvl: Number(rawData.lvl || 1)
            };
            
            if (!this.user.username || this.user.username === 'Agent') {
                this.user.username = username;
            }
            
            if (typeof ui !== 'undefined') ui.init();
            this.startLoops();
        } catch (e) {
            console.error("❌ Ошибка загрузки:", e);
        }
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
        } catch (e) { console.error("Ошибка сохранения:", e); }
    },

    // Метод для сохранения адреса кошелька в БД
    async connectWallet() {
        const fakeAddress = "EQD4k...zP8n"; // Имитация адреса для примера
        try {
            const res = await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.user_id,
                    address: fakeAddress
                })
            });
            const data = await res.json();
            if (data.ok) {
                this.user.wallet = fakeAddress;
                ui.openM('wallet'); // Перерисовать окно
            }
        } catch (e) { console.error("Ошибка кошелька:", e); }
    },

    tap() {
        if (this.user && this.user.energy >= 1) {
            this.user.balance = Number(this.user.balance) + Number(this.user.click_lvl);
            this.user.energy -= 1;
            if (typeof ui !== 'undefined') {
                ui.update();
                ui.anim(window.event);
            }
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
            if (typeof ui !== 'undefined') ui.update();
        }, 1000);
    }
};

window.onload = () => logic.init();
