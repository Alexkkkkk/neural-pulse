const logic = {
    user: {
        userId: 0,
        balance: 696,
        energy: 543,
        max_energy: 1000,
        click_lvl: 2,
        profit_hr: 0,
        lvl: 2
    },

    // Синхронизация: берем ID из Telegram и тянем данные из БД
    async syncWithDB() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
            this.user.userId = tgUser.id;
            document.getElementById('u-name').innerText = tgUser.first_name || "Agent";
        }

        try {
            // Запрос к твоему main.py
            const res = await fetch(`/api/user/${this.user.userId || 0}`);
            if (res.ok) {
                const data = await res.json();
                this.user = { ...this.user, ...data };
            }
        } catch (e) {
            console.log("Offline mode: using local/default data");
        }
    },

    // Сохранение прогресса
    async save() {
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.user)
            });
        } catch (e) {
            localStorage.setItem('pulse_save', JSON.stringify(this.user));
        }
    },

    // Логика тапа (из идеальной версии 3.8.0)
    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            // Визуальный эффект +число
            this.createTapText(e);
            
            ui.update();
            
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }
    },

    createTapText(e) {
        const t = document.createElement('div');
        t.innerText = `+${this.user.click_lvl}`;
        t.className = 'tap-pop'; // Добавь анимацию в style.css
        t.style.left = `${e.clientX}px`;
        t.style.top = `${e.clientY}px`;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 700);
    },

    // Постоянный цикл обновления (доход и энергия)
    startLoop() {
        setInterval(() => {
            let needsUpdate = false;

            // Реген энергии +1 в сек
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                needsUpdate = true;
            }

            // Пассивный доход (делим профит в час на 3600 сек)
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
                needsUpdate = true;
            }

            if (needsUpdate) ui.update();
        }, 1000);

        // Авто-сейв каждые 20 секунд
        setInterval(() => this.save(), 20000);
    }
};
