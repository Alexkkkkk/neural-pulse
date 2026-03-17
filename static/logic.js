const logic = {
    user: {
        userId: 0,
        balance: 696,
        energy: 543,
        max_energy: 1000,
        click_lvl: 1,
        profit_hr: 0
    },

    async syncWithDB() {
        if (!window.Telegram?.WebApp?.initDataUnsafe?.user) return;
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        this.user.userId = tgUser.id;

        try {
            const res = await fetch(`/api/user/${tgUser.id}?name=${tgUser.first_name}`);
            const data = await res.json();
            this.user = { ...this.user, ...data };
        } catch (e) { console.error("Sync Error", e); }
    },

    async save() {
        await fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: this.user.user_id, ...this.user })
        });
    },

    tap() {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            ui.update();
            this.save(); // Сохраняем при каждом клике или добавь таймер
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }
    }
};
