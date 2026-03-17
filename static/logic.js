const logic = {
    user: {
        userId: 0,
        balance: 696,
        energy: 543,
        max_energy: 1000,
        click_lvl: 1,
        profit_hr: 0,
        lvl: 2
    },

    // Синхронизация с БД (из версии 3.6.0)
    async syncWithDB() {
        if (!window.Telegram?.WebApp?.initDataUnsafe?.user) return;
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        this.user.userId = tgUser.id;

        try {
            const res = await fetch(`/api/user/${tgUser.id}?name=${encodeURIComponent(tgUser.first_name)}`);
            if (res.ok) {
                const data = await res.json();
                this.user = { ...this.user, ...data };
            }
        } catch (e) { 
            console.error("Sync Error - Offline mode active", e); 
        }
    },

    // Сохранение данных на сервер
    async save() {
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: this.user.userId, ...this.user })
            });
        } catch (e) {
            // В оффлайне сохраняем в localStorage
            localStorage.setItem('pulse_backup', JSON.stringify(this.user));
        }
    },

    // Функция тапа с анимацией (из версии 3.8.0)
    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            // Создаем вылетающий текст +1
            this.createTapAnim(e);
            
            ui.update();
            
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }
    },

    createTapAnim(e) {
        const el = document.createElement('div');
        el.innerText = `+${this.user.click_lvl}`;
        el.className = 'tap-pop'; // Добавь анимацию в CSS
        el.style.left = `${e.clientX}px`;
        el.style.top = `${e.clientY}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    },

    // Игровой цикл: доход и энергия (из стабильных версий)
    startLoop() {
        setInterval(() => {
            let changed = false;

            // Регенерация энергии (+1 в секунду)
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                changed = true;
            }

            // Пассивный доход в час
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
                changed = true;
            }

            if (changed) ui.update();
        }, 1000);

        // Авто-сохранение каждые 15 секунд
        setInterval(() => this.save(), 15000);
    }
};
