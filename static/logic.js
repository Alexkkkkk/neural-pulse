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

            if (typeof ui !== 'undefined') ui.init();
            
            this.startLoops();
            return true;
        } catch (e) {
            console.error("Init Error", e);
            return false;
        }
    },

    tap(e) {
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

    // НОВАЯ ФУНКЦИЯ: Покупка улучшений
    buyUpgrade(type) {
        if (!this.user) return;
        
        if (type === 'tap' && this.user.balance >= 5000) {
            this.user.balance -= 5000;
            this.user.click_lvl += 1;
        } else if (type === 'energy' && this.user.balance >= 10000) {
            this.user.balance -= 10000;
            this.user.max_energy += 500;
            this.user.energy += 500;
        } else if (type === 'profit' && this.user.balance >= 25000) {
            this.user.balance -= 25000;
            this.user.profit_hr += 500;
        } else {
            alert("Недостаточно средств!");
            return;
        }
        
        if (typeof ui !== 'undefined') {
            ui.update();
            ui.openM(type === 'profit' ? 'mine' : 'boost'); // Обновляем текст в модалке
        }
        this.save();
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
        setInterval(() => {
            if (!this.user) return;
            
            // Реген энергии
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1.5);
            }
            
            // Пассивный доход
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            
            if (typeof ui !== 'undefined') ui.update();
        }, 1000);

        setInterval(() => this.save(), 10000);
    }
};
