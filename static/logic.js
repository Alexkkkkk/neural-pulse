const logic = {
    user: {
        userId: 0,
        balance: 0,
        energy: 1000,
        max_energy: 1000,
        click_lvl: 1,
        profit: 0,
        level: 1,
        username: "Agent"
    },

    // Главная функция старта
    async init() {
        console.log("🚀 Инициализация логики...");
        
        // 1. Настройка Telegram WebApp
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            
            // Пытаемся получить реальные данные пользователя
            const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
            if (tgUser) {
                this.user.userId = tgUser.id;
                this.user.username = tgUser.first_name || "Agent";
                
                // Сразу отображаем имя, если элемент уже в DOM
                const nameEl = document.getElementById('u-name');
                if (nameEl) nameEl.innerText = this.user.username;
            } else {
                this.user.userId = "test_user";
                console.warn("⚠️ Запущено вне Telegram. Используется test_user.");
            }
        } else {
            this.user.userId = "test_user";
        }

        // 2. Ждем загрузки данных из базы данных
        await this.syncWithDB();
        
        // 3. Настраиваем клики
        this.setupListeners();

        // 4. Обновляем UI в первый раз, чтобы убрать нули
        if (window.ui) {
            ui.init();
        }
        
        console.log("✅ Логика готова к работе");
    },

    // Обработка клика по логотипу
    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            // pointerdown работает быстрее, чем click, и поддерживает мультитач
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.tap(e);
            });
        }
    },

    // Загрузка данных с сервера
    async syncWithDB() {
        if (!this.user.userId || this.user.userId === "test_user") return;
        
        try {
            // Добавляем timestamp, чтобы избежать кэширования браузером
            const res = await fetch(`/api/user/${this.user.userId}?v=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = Number(data.balance) || 0;
                this.user.energy = Number(data.energy) || 1000;
                this.user.max_energy = Number(data.max_energy) || 1000;
                this.user.click_lvl = Number(data.click_lvl) || 1;
                this.user.profit = Number(data.profit_hr) || 0;
                this.user.level = Number(data.lvl) || 1;
                console.log("📥 Данные из БД успешно получены");
            }
        } catch (e) {
            console.error("❌ Ошибка при обращении к API:", e);
        }
    },

    // Метод для клика (тапа)
    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            if (window.ui) {
                ui.update();
                ui.anim(e); // Вылетающие цифры
            }

            // Легкая вибрация при каждом клике
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        } else {
            // Вибрация ошибки, если нет энергии
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
            }
        }
    },

    // Универсальный метод покупки
    async buyUpgrade(type, cost, value) {
        if (this.user.balance >= cost) {
            this.user.balance -= cost;
            
            if (type === 'tap') this.user.click_lvl += value;
            if (type === 'energy') this.user.max_energy += value;
            if (type === 'profit') this.user.profit += value;
            
            if (window.ui) ui.update();
            
            // Сохраняем немедленно после покупки
            await this.save();
            return true;
        }
        return false;
    },

    // Отправка данных на сервер
    async save() {
        if (!this.user.userId || this.user.userId === "test_user") return;
        
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.userId,
                    balance: Math.floor(this.user.balance),
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: Math.floor(this.user.profit),
                    lvl: this.user.level
                })
            });
        } catch (e) {
            console.error("💾 Ошибка автосохранения");
        }
    },

    // Запуск таймеров
    startPassiveIncome() {
        // Каждую секунду: доход и регенерация энергии
        setInterval(() => {
            // Реген энергии (+1 в сек)
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
            }
            
            // Пассивный доход (делим часовую прибыль на 3600 сек)
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
            }
            
            if (window.ui) ui.update();
        }, 1000);

        // Автосохранение каждые 15 секунд
        setInterval(() => this.save(), 15000);
    }
};
