const logic = {
    user: {
        userId: 0, balance: 0, energy: 1000, max_energy: 1000,
        click_lvl: 1, profit: 0, level: 1, username: "Agent",
        isLiked: false, likes: 0
    },

    async init() {
        console.log("🔍 [INIT] Запуск инициализации логики...");
        
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();
            const tgUser = tg.initDataUnsafe?.user;
            if (tgUser) {
                this.user.userId = tgUser.id.toString();
                this.user.username = tgUser.first_name || "Agent";
                console.log("👤 [USER] Telegram ID:", this.user.userId);
            }
        }

        if (!this.user.userId || this.user.userId === 0) {
            this.user.userId = "test_user_123"; 
            console.warn("⚠️ [USER] Используем тестовый ID");
        }

        await this.syncWithDB();
        this.setupListeners();
        this.startPassiveIncome();
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        console.log("🎯 [UI] Поиск tap-target:", target ? "✅ Найдено" : "❌ НЕ НАЙДЕНО");

        if (target) {
            // Принудительно разрешаем события
            target.style.pointerEvents = 'auto';
            
            // pointerdown срабатывает быстрее чем click
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                console.log("⚡ [EVENT] Нажатие зафиксировано");
                this.tap(e);
            });
        }
    },

    async syncWithDB() {
        console.log("📡 [DB] Синхронизация с базой...");
        try {
            const res = await fetch(`/api/user/${this.user.userId}`);
            if (!res.ok) throw new Error(`Server status: ${res.status}`);
            const data = await res.json();
            
            console.log("📥 [DB] Данные загружены:", data);

            this.user.balance = parseFloat(data.balance) || 0;
            this.user.energy = parseInt(data.energy) || 1000;
            this.user.max_energy = parseInt(data.max_energy) || 1000;
            this.user.click_lvl = parseInt(data.click_lvl) || 1;
            this.user.profit = parseFloat(data.profit_hr) || 0;
            this.user.level = parseInt(data.lvl) || 1;
            this.user.isLiked = data.is_liked || false;
            this.user.likes = parseInt(data.likes) || 0;
            
            if (window.ui && typeof ui.update === 'function') {
                ui.update();
            }
        } catch (e) { 
            console.error("❌ [DB ERROR] Ошибка загрузки:", e); 
        }
    },

    tap(e) {
        console.log(`🖱️ [TAP] Попытка тапа. Энергия: ${this.user.energy}`);
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            console.log(`✅ [TAP SUCCESS] Баланс: ${this.user.balance}`);

            if (window.ui) {
                try {
                    ui.update();
                    if (ui.anim) ui.anim(e);
                } catch (err) {
                    console.error("❌ [UI UPDATE ERROR] Ошибка в ui.js:", err);
                }
            }

            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        } else {
            console.warn("🚫 [TAP] Недостаточно энергии");
        }
    },

    startPassiveIncome() {
        console.log("⚙️ [SYSTEM] Таймеры запущены");
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                if (window.ui) ui.update();
            }
        }, 1000);

        setInterval(() => {
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
                if (window.ui) ui.update();
            }
        }, 1000);

        setInterval(() => this.save(), 10000);
    },

    async save() {
        console.log("📤 [SAVE] Отправка данных...");
        try {
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.userId,
                    balance: Math.floor(this.user.balance),
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: Math.floor(this.user.profit),
                    lvl: this.user.level,
                    is_liked: this.user.isLiked,
                    likes: this.user.likes
                })
            });
            const resData = await response.json();
            console.log("💾 [SAVE] Успешно сохранено:", resData);
        } catch (e) { 
            console.error("❌ [SAVE ERROR] Ошибка:", e); 
        }
    }
};

// Запуск
logic.init();
