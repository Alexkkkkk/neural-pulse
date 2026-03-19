const logic = {
    user: null,

    async init() {
        console.log("🚀 Logic Booting...");
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            tg.enableClosingConfirmation();
        }

        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const firstName = tg?.initDataUnsafe?.user?.first_name || "Agent";

        try {
            const res = await fetch(`/api/user/${userId}`);
            const data = await res.json();
            
            this.user = {
                user_id: String(userId),
                username: firstName,
                balance: Number(data.balance || 0),
                energy: Number(data.energy !== undefined ? data.energy : 1000),
                max_energy: Number(data.max_energy || 1000),
                click_lvl: Number(data.click_lvl || 1),
                profit_hr: Number(data.profit_hr || 0),
                lvl: Number(data.lvl || 1),
                wallet: data.wallet || null
            };

            this.startLoops();
            ui.init();
            return true;
        } catch (e) {
            console.error("Init Error", e);
            ui.init();
            return false;
        }
    },

    tap(e) {
        if (!this.user || this.user.energy < 1) return;

        this.user.balance += this.user.click_lvl;
        this.user.energy -= 1;
        
        ui.update();
        this.anim(e);
    },

    anim(e) {
        // Получаем координаты клика (поддержка touch и mouse)
        const x = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const y = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        const p = document.createElement('div');
        p.className = 'tap-pop';
        p.innerText = `+${this.user.click_lvl}`;
        p.style.left = `${x - 20}px`;
        p.style.top = `${y - 40}px`;
        document.body.appendChild(p);

        setTimeout(() => p.remove(), 800);
    },

    upgrade(type) {
        if (!this.user) return;
        let cost = 0;

        if (type === 'tap') {
            cost = this.user.click_lvl * 1000;
            if (this.user.balance >= cost) {
                this.user.balance -= cost;
                this.user.click_lvl++;
                console.log("Upgraded Tap");
            } else { alert("Not enough balance!"); return; }
        } else if (type === 'energy') {
            cost = (this.user.max_energy / 100) * 500;
            if (this.user.balance >= cost) {
                this.user.balance -= cost;
                this.user.max_energy += 500;
                this.user.lvl++;
                console.log("Upgraded Energy");
            } else { alert("Not enough balance!"); return; }
        }

        ui.update();
        ui.openM('boost'); // Обновить модалку
    },

    startLoops() {
        setInterval(() => {
            if (!this.user) return;
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
            }
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            ui.update();
        }, 1000);

        setInterval(() => this.save(), 10000);
    },

    async save() {
        if (!this.user) return;
        fetch('/api/save', {
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
    }
};

window.onload = () => logic.init();
