const logic = {
    user: null,
    async init() {
        const tg = window.Telegram?.WebApp;
        // Получаем ID и имя из Telegram, либо ставим заглушку для тестов
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const username = tg?.initDataUnsafe?.user?.username || "Agent";

        try {
            // Загружаем данные из твоего API (server.js)
            const res = await fetch(`/api/user/${userId}`);
            const rawData = await res.json();
            
            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Превращаем все строки из БД в числа
            this.user = {
                ...rawData,
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy || 0),
                max_energy: Number(rawData.max_energy || 1000),
                click_lvl: Number(rawData.click_lvl || 1),
                profit_hr: Number(rawData.profit_hr || 0),
                lvl: Number(rawData.lvl || 1),
                likes: Number(rawData.likes || 0)
            };
            
            // Если в БД еще нет имени, ставим из ТГ
            if (!this.user.username || this.user.username === 'Agent') {
                this.user.username = username;
            }
            
            console.log("✅ [LOGIC] Данные загружены и конвертированы:", this.user);
            if (typeof ui !== 'undefined') ui.init();
            
            this.startLoops();
        } catch (e) {
            console.error("❌ Ошибка инициализации:", e);
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
        } catch (e) { console.error("Ошибка сохранения:", e); }
    },

    tap() {
        if (this.user && this.user.energy >= 1) {
            // Гарантируем математическое сложение чисел
            this.user.balance = Number(this.user.balance) + Number(this.user.click_lvl);
            this.user.energy -= 1;
            
            // Логика повышения уровня (каждые 100 000 монет)
            const newLvl = Math.floor(this.user.balance / 100000) + 1;
            if (newLvl > this.user.lvl) {
                this.user.lvl = newLvl;
                if (window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
            }

            if (typeof ui !== 'undefined') {
                ui.update();
                ui.anim(window.event);
            }
        }
    },

    startLoops() {
        // Авто-сохранение в PostgreSQL каждые 10 секунд
        setInterval(() => this.save(), 10000);
        
        // Регенерация энергии и доход в час
        setInterval(() => {
            if (!this.user) return;
            
            if (this.user.energy < this.user.max_energy) {
                this.user.energy += 1;
            }
            
            if (this.user.profit_hr > 0) {
                // Прибавляем пассивный доход (делим на 3600 секунд в часе)
                this.user.balance = Number(this.user.balance) + (Number(this.user.profit_hr) / 3600);
            }
            
            if (typeof ui !== 'undefined') ui.update();
        }, 1000);
    },

    async buyUpgrade(type, cost, val) {
        if (this.user.balance >= cost) {
            this.user.balance -= cost;
            
            if (type === 'tap') {
                this.user.click_lvl = Number(this.user.click_lvl) + val;
            }
            if (type === 'energy') {
                this.user.max_energy = Number(this.user.max_energy) + val;
            }
            
            await this.save();
            if (typeof ui !== 'undefined') ui.update();
            return true;
        }
        return false;
    }
};

window.onload = () => logic.init();
