const logic = {
    user: null,

    async init() {
        const tg = window.Telegram?.WebApp;
        if (tg) { 
            tg.ready(); 
            tg.expand(); 
        }

        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const firstName = tg?.initDataUnsafe?.user?.first_name || "Agent";

        try {
            // Запрос данных пользователя с сервера
            const res = await fetch(`/api/user/${userId}?username=${encodeURIComponent(firstName)}`);
            const data = await res.json();

            this.user = {
                user_id: String(userId),
                username: data.username || firstName,
                balance: Number(data.balance || 0),
                energy: Number(data.energy ?? 1000),
                max_energy: Number(data.max_energy || 1000),
                click_lvl: Number(data.click_lvl || 1),
                profit_hr: Number(data.profit_hr || 0),
                lvl: Number(data.lvl || 1)
            };

            const nameEl = document.getElementById('u-name');
            if (nameEl) nameEl.innerText = this.user.username;

            // Инициализация интерфейса (ui.js / script в HTML)
            if (typeof ui !== 'undefined') ui.init();
            
            this.startLoops();
            return true;
        } catch (e) {
            console.error("Neural Pulse Init Error:", e);
            return false;
        }
    },

    tap(e) {
        // Предотвращаем зум и лишние срабатывания на мобилках
        if (e.type === 'touchstart') e.preventDefault();
        
        if (!this.user || this.user.energy < this.user.click_lvl) return;
        
        this.user.balance += this.user.click_lvl;
        this.user.energy -= this.user.click_lvl;
        
        if (typeof ui !== 'undefined') ui.update();
        this.anim(e);

        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    },

    anim(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const p = document.createElement('div');
        p.className = 'tap-pop';
        p.innerText = `+${this.user.click_lvl}`;
        p.style.left = `${clientX}px`;
        p.style.top = `${clientY}px`;
        
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 800);
    },

    async buyUpgrade(type) {
        if (!this.user) return;
        
        let success = false;
        // Простая логика цен (можно усложнить формулой)
        if (type === 'tap' && this.user.balance >= 5000) {
            this.user.balance -= 5000;
            this.user.click_lvl += 1;
            success = true;
        } else if (type === 'energy' && this.user.balance >= 10000) {
            this.user.balance -= 10000;
            this.user.max_energy += 500;
            this.user.energy += 500;
            success = true;
        } else if (type === 'profit' && this.user.balance >= 25000) {
            this.user.balance -= 25000;
            this.user.profit_hr += 500;
            success = true;
        }

        if (success) {
            if (typeof ui !== 'undefined') {
                ui.update();
                // Перерисовываем модалку, чтобы обновить уровни и цены
                ui.openM(type === 'profit' ? 'mine' : 'boost');
            }
            await this.save();
        } else {
            window.Telegram?.WebApp?.showConfirm ? 
                window.Telegram.WebApp.showAlert("Not enough Pulse!") : 
                alert("Not enough Pulse!");
        }
    },

    // Новая функция для выполнения заданий
    async claimTask(taskId, reward) {
        if (!this.user) return;
        
        this.user.balance += reward;
        window.Telegram?.WebApp?.showAlert(`Task Completed! +${reward.toLocaleString()} Pulse`);
        
        if (typeof ui !== 'undefined') ui.update();
        await this.save();
    },

    async save() {
        if (!this.user) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.user_id,
                    balance: Math.floor(this.user.balance),
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: this.user.profit_hr,
                    lvl: this.user.lvl
                })
            });
        } catch (err) { 
            console.warn("Sync failed (background)", err); 
        }
    },

    startLoops() {
        // Цикл 1: Регенерация энергии и пассивный доход (каждую секунду)
        setInterval(() => {
            if (!this.user) return;
            
            // Реген энергии (+1.5 в сек)
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1.5);
            }
            
            // Доход в час -> Доход в секунду
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            
            // Обновляем только цифры в UI, чтобы не нагружать DOM
            if (typeof ui !== 'undefined') ui.update();
        }, 1000);

        // Цикл 2: Автосохранение на сервер (каждые 10 секунд)
        setInterval(() => this.save(), 10000);
    }
};
