const logic = {
    user: null,

    async init() {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
        }

        // Берем ID из Телеграм или ставим тестовый
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const firstName = tg?.initDataUnsafe?.user?.first_name || "Agent";

        try {
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

            // Инициализируем интерфейс ПОСЛЕ загрузки данных
            if (typeof ui !== 'undefined') ui.init();
            
            this.startLoops();
            return true;
        } catch (e) {
            console.error("Init Error", e);
            return false;
        }
    },

    tap(e) {
        // Предотвращаем стандартное поведение (зум и т.д.)
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
        // Поддержка и мыши, и тача
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

    async save() {
        if (!this.user) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.user_id,
                    balance: this.user.balance,
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: this.user.profit_hr,
                    lvl: this.user.lvl
                })
            });
        } catch (err) {
            console.warn("Save failed", err);
        }
    },

    startLoops() {
        // Ежесекундное обновление: реген энергии + доход в час
        setInterval(() => {
            if (!this.user) return;
            
            // Реген энергии (1.5 в сек)
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1.5);
            }
            
            // Пассивный доход
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            
            if (typeof ui !== 'undefined') ui.update();
        }, 1000);

        // Автосохранение каждые 10 сек
        setInterval(() => this.save(), 10000);
    }
};
