const logic = {
    user: {
        userId: 0,
        balance: 0,
        energy: 1000,
        max_energy: 1000,
        click_lvl: 1,
        profit: 0,
        level: 1,
        username: "Agent",
        isLiked: false,
        likes: 0
    },

    async init() {
        console.log("🚀 Logic: Syncing...");
        
        // Инициализация Telegram WebApp
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();
            
            const tgUser = tg.initDataUnsafe?.user;
            if (tgUser) {
                this.user.userId = tgUser.id.toString();
                this.user.username = tgUser.first_name || "Agent";
            }
        }

        // Резервный ID для тестов вне Telegram
        if (!this.user.userId || this.user.userId === 0) {
            this.user.userId = "test_user_123"; 
        }

        // Загружаем данные и только потом запускаем процессы
        await this.syncWithDB();
        this.setupListeners();
        this.startPassiveIncome(); // ВАЖНО: добавил вызов функции
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            // Используем pointerdown для мгновенного отклика (без задержки 300мс)
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.tap(e);
            });
        }
    },

    async syncWithDB() {
        try {
            const res = await fetch(`/api/user/${this.user.userId}`);
            if (res.ok) {
                const data = await res.json();
                
                // Приведение типов: база часто возвращает строки или null
                this.user.balance = parseFloat(data.balance) || 0;
                this.user.energy = parseInt(data.energy) || 1000;
                this.user.max_energy = parseInt(data.max_energy) || 1000;
                this.user.click_lvl = parseInt(data.click_lvl) || 1;
                this.user.profit = parseFloat(data.profit_hr) || 0;
                this.user.level = parseInt(data.lvl) || 1;
                this.user.isLiked = data.is_liked || false;
                this.user.likes = parseInt(data.likes) || 0;
                
                if (window.ui) ui.update();
            }
        } catch (e) { 
            console.error("❌ DB Sync Error:", e); 
        }
    },

    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            // Обновляем локально для мгновенного визуального эффекта
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            if (window.ui) {
                ui.update();
                ui.anim(e); // Вылетающие цифры + анимация нажатия
            }

            // Вибрация
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        } else {
            // Если энергии нет — красная вибрация
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
            }
        }
    },

    toggleLike() {
        this.user.isLiked = !this.user.isLiked;
        this.user.likes += this.user.isLiked ? 1 : -1;
        if (window.ui) ui.update();
        this.save();
    },

    async buyUpgrade(type, cost, val) {
        if (this.user.balance >= cost) {
            this.user.balance -= cost;
            if (type === 'tap') this.user.click_lvl += val;
            if (type === 'energy') this.user.max_energy += val;
            if (type === 'profit') this.user.profit += val;
            
            if (window.ui) ui.update();
            await this.save();
            return true;
        }
        return false;
    },

    startPassiveIncome() {
        console.log("⛏️ Passive income started");
        
        // Энергия +1 каждую секунду
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                if (window.ui) ui.update();
            }
        }, 1000);

        // Пассивный доход (начисляем маленькими частями каждую секунду)
        setInterval(() => {
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
                if (window.ui) ui.update();
            }
        }, 1000);

        // Автосохранение в БД раз в 10 секунд
        setInterval(() => this.save(), 10000);
    },

    async save() {
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.userId,
                    balance: Math.floor(this.user.balance), // Округляем для базы
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: Math.floor(this.user.profit),
                    lvl: this.user.level,
                    is_liked: this.user.isLiked,
                    likes: this.user.likes
                })
            });
            console.log("💾 Data autosaved");
        } catch (e) { 
            console.error("❌ Save Error:", e); 
        }
    }
};

// Запуск инициализации
logic.init();
