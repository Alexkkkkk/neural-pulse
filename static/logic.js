const logic = {
    user: {
        userId: 0,
        balance: 696,
        energy: 543,
        max_energy: 1000,
        tap_val: 2,
        profit: 0,
        level: 2,
        ref_count: 0 // Добавлено из 3.8.0
    },

    init() {
        this.syncWithDB().then(() => {
            this.startPassiveIncome();
            this.setupListeners();
            ui.init();
        });
        console.log("Neural Pulse Core v3.8.0 Stable Fully Loaded");
    },

    // Настройка всех слушателей событий (из 3.8.0)
    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            target.addEventListener('pointerdown', (e) => this.tap(e));
        }

        // Обработка переключения табов меню
        document.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = () => {
                const tabId = item.getAttribute('data-tab');
                ui.switchTab(tabId);
            };
        });
    },

    async syncWithDB() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tg = window.Telegram.WebApp.initDataUnsafe.user;
            this.user.userId = tg.id;
            const nameEl = document.getElementById('u-name');
            if (nameEl) nameEl.innerText = tg.first_name || "Agent";
        }

        try {
            // В 3.8.0 мы также передавали start_param для рефералов
            const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
            const res = await fetch(`/api/user/${this.user.userId}?ref=${startParam}`);
            
            if (res.ok) {
                const data = await res.json();
                // Приведение типов для исключения ошибок с NUMERIC
                this.user = {
                    ...this.user,
                    ...data,
                    balance: parseFloat(data.balance),
                    profit: parseFloat(data.profit_hr || data.profit || 0)
                };
            }
        } catch (e) {
            console.warn("Offline mode active.");
        }
    },

    async save() {
        if (!this.user.userId || this.user.userId === 0) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    userId: this.user.userId,
                    balance: Math.floor(this.user.balance),
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.tap_val,
                    profit_hr: this.user.profit,
                    lvl: this.user.level
                })
            });
        } catch (e) { /* Игнорируем ошибки сети при сохранении */ }
    },

    tap(e) {
        if (this.user.energy >= this.user.tap_val) {
            this.user.balance += this.user.tap_val;
            this.user.energy -= this.user.tap_val;
            
            this.showClickAnim(e);
            ui.update();
            this.checkLevelUp();

            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        }
    },

    startPassiveIncome() {
        // Регенерация энергии (стабильные 1000мс)
        setInterval(() => {
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                ui.update();
            }
        }, 1000);

        // Доход в секунду (исправлено: без дробей)
        setInterval(() => {
            if (this.user.profit > 0) {
                const perSec = Math.floor(this.user.profit / 3600);
                if (perSec > 0) {
                    this.user.balance += perSec;
                    ui.update();
                }
            }
        }, 1000);

        // Интервал сохранения (20 сек как в 3.8.0)
        setInterval(() => this.save(), 20000);
    },

    // Функция проверки уровня с уведомлением (из 3.8.0)
    checkLevelUp() {
        const nextLvlThreshold = this.user.level * 500000000; 
        if (this.user.balance >= nextLvlThreshold) {
            this.user.level++;
            if (window.Telegram?.WebApp) {
                Telegram.WebApp.showAlert(`Поздравляем! Вы достигли ${this.user.level} уровня!`);
            }
            ui.update();
        }
    },

    showClickAnim(e) {
        const x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        
        const el = document.createElement('div');
        el.className = 'tap-pop'; // Использование CSS класса для производительности
        el.innerText = `+${this.user.tap_val}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
};

// Входная точка
window.onload = () => logic.init();
