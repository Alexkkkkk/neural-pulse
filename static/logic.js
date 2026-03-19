const logic = {
    user: null,
    async init() {
        const tg = window.Telegram?.WebApp;
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const username = tg?.initDataUnsafe?.user?.username || "Agent";

        try {
            // Загружаем данные из БД
            const res = await fetch(`/api/user/${userId}`);
            this.user = await res.json();
            this.user.username = username; // Обновляем имя из ТГ
            
            console.log("✅ [LOGIC] Данные загружены:", this.user);
            if (typeof ui !== 'undefined') ui.init();
            
            // Запуск циклов
            this.startLoops();
        } catch (e) {
            console.error("❌ Ошибка загрузки данных", e);
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
                    lvl: this.user.lvl,
                    likes: this.user.likes,
                    is_liked: this.user.is_liked
                })
            });
        } catch (e) { console.error("Ошибка сохранения", e); }
    },

    tap() {
        if (this.user.energy >= 1) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= 1;
            if (typeof ui !== 'undefined') {
                ui.update();
                ui.anim(window.event);
            }
        }
    },

    startLoops() {
        // Сохранение каждые 10 секунд
        setInterval(() => this.save(), 10000);
        
        // Регенерация энергии + пассивный доход
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) this.user.energy += 1;
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            if (typeof ui !== 'undefined') ui.update();
        }, 1000);
    },

    async buyUpgrade(type, cost, val) {
        if (this.user.balance >= cost) {
            this.user.balance -= cost;
            if (type === 'tap') this.user.click_lvl += val;
            if (type === 'energy') this.user.max_energy += val;
            
            // Повышаем уровень каждые 5 покупок (пример логики)
            if ((this.user.click_lvl + this.user.max_energy / 500) % 5 === 0) {
                this.user.lvl += 1;
            }
            
            await this.save();
            ui.update();
            return true;
        }
        return false;
    }
};

// Запуск при загрузке страницы
window.onload = () => logic.init();
