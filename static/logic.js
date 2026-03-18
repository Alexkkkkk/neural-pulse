const logic = {
    // Данные пользователя по умолчанию
    user: {
        userId: 0,
        balance: 696,
        energy: 543,
        max_energy: 1000,
        tap_val: 2,
        profit: 0,
        level: 2
    },

    // 1. Инициализация (из стабильной 3.8.0)
    init() {
        this.startPassiveIncome();
        // Назначаем тапы ( pointerdown мгновенно реагирует на телефонах)
        document.getElementById('tap-target').addEventListener('pointerdown', (e) => this.tap(e));
        console.log("Neural Pulse Core logic v3.8.0 stable loaded");
    },

    // 2. Синхронизация с базой данных (критично для сохранения)
    async syncWithDB() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tg = window.Telegram.WebApp.initDataUnsafe.user;
            this.user.userId = tg.id;
            // Устанавливаем имя из Telegram
            document.getElementById('u-name').innerText = tg.first_name || "Agent";
        }

        try {
            // Запрос данных с сервера main.py
            const res = await fetch(`/api/user/${this.user.userId || 0}`);
            if (res.ok) {
                const data = await res.json();
                // Объединяем, приоритет у данных из БД
                this.user = { ...this.user, ...data };
                console.log("Синхронизация с БД успешна");
            }
        } catch (e) {
            console.warn("БД недоступна, работаем оффлайн.");
        }
    },

    // 3. Сохранение данных на сервер
    async save() {
        if (!this.user.userId) return; // Не сохраняем, если нет ID

        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.user)
            });
        } catch (e) { console.warn("Ошибка сохранения."); }
    },

    // 4. Логика тапа (с учетом координат для анимации)
    tap(e) {
        if (this.user.energy >= this.user.tap_val) {
            this.user.balance += this.user.tap_val;
            this.user.energy -= this.user.tap_val;
            
            // Вызываем визуальный эффект
            this.showClickAnim(e);
            
            ui.update(); // Мгновенно обновляем интерфейс
            this.checkLevelUp(); // Проверяем уровень

            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }
    },

    // 5. Расчет пассивного дохода без ошибок дробей ( Math.floor )
    startPassiveIncome() {
        // Регенерация энергии +1 в сек
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                ui.update(); // Обновляем полоску энергии
            }
        }, 1000);

        // Начисление пассивного дохода
        if (this.user.profit > 0) {
            setInterval(() => {
                // Главное исправление: используем Math.floor, чтобы не было дробей
                const incomePerSec = Math.floor(this.user.profit / 3600);
                if (incomePerSec > 0) {
                    this.user.balance += incomePerSec;
                    ui.update(); // Обновляем баланс
                }
            }, 1000);
        }

        // Авто-сохранение каждые 20 секунд
        setInterval(() => this.save(), 20000);
    },

    // Простая логика уровней (по балансу)
    checkLevelUp() {
        let threshold = this.user.level * 250000000; // Пример порога
        if (this.user.balance >= threshold) {
            this.user.level++;
            ui.update(); // Обновляем плашку уровня
        }
    },

    // Анимация вылетающих цифр при клике
    showClickAnim(e) {
        const x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        
        const el = document.createElement('div');
        el.innerText = `+${this.user.tap_val}`;
        el.style.cssText = `
            position: fixed; top: ${y}px; left: ${x}px;
            color: #00ffff; font-weight: 900; font-size: 24px;
            pointer-events: none; animation: moveUp 0.8s ease-out forwards;
            z-index: 10000; text-shadow: 0 0 10px rgba(0,255,255,0.5);
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
};
