const logic = {
    user: null,
    tonConnectUI: null,

    async init() {
        const tg = window.Telegram?.WebApp;
        tg?.expand();
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        
        try {
            const res = await fetch(`/api/user/${userId}`);
            const rawData = await res.json();
            
            this.user = {
                ...rawData,
                user_id: String(userId),
                balance: Number(rawData.balance),
                energy: Number(rawData.energy),
                max_energy: Number(rawData.max_energy),
                click_lvl: Number(rawData.click_lvl),
                profit_hr: Number(rawData.profit_hr),
                lvl: Number(rawData.lvl)
            };
            
            this.startLoops();
            return true; 
        } catch (e) {
            console.error("DB Load Error", e);
            return false;
        }
    },

    tap(e) {
        if (this.user && this.user.energy >= 1) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= 1;
            ui.update();
            ui.anim(e);
        }
    },

    startLoops() {
        // Регенерация энергии и пассивный доход раз в секунду
        setInterval(() => {
            if (!this.user) return;
            if (this.user.energy < this.user.max_energy) this.user.energy += 1;
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            ui.update();
        }, 1000);

        // Автосохранение в БД каждые 10 секунд
        setInterval(() => this.save(), 10000);
    },

    async save() {
        if (!this.user) return;
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
    }
};
