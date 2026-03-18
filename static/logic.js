const logic = {
    user: {
        userId: 0,
        balance: 0,
        energy: 1000,
        max_energy: 1000,
        click_lvl: 1,
        profit_hr: 0,
        lvl: 1
    },

    async syncWithDB() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tg = window.Telegram.WebApp.initDataUnsafe.user;
            this.user.userId = tg.id;
            const nameEl = document.getElementById('u-name');
            if (nameEl) nameEl.innerText = tg.first_name || "Agent";
        }

        try {
            const res = await fetch(`/api/user/${this.user.userId}`);
            if (res.ok) {
                const data = await res.json();
                this.user = { ...this.user, ...data };
                this.user.balance = parseFloat(this.user.balance);
                this.user.profit_hr = parseFloat(this.user.profit_hr);
            }
        } catch (e) { console.log("Offline mode."); }
    },

    async save() {
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.user)
            });
        } catch (e) {
            localStorage.setItem('pulse_data', JSON.stringify(this.user));
        }
    },

    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            
            this.createEffect(e);
            ui.update();
            
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }
    },

    createEffect(e) {
        const x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        
        const el = document.createElement('div');
        el.className = 'tap-pop';
        el.innerText = `+${this.user.click_lvl}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    },

    startIntervals() {
        setInterval(() => {
            let changed = false;
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                changed = true;
            }
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
                changed = true;
            }
            if (changed) ui.update();
        }, 1000);

        setInterval(() => this.save(), 15000);
    }
};
