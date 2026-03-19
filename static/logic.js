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

            document.getElementById('u-name').innerText = this.user.username;
            ui.init();
            this.startLoops();
            return true;
        } catch (e) {
            console.error("Init Error", e);
            return false;
        }
    },

    tap(e) {
        if (!this.user || this.user.energy < 1) return;
        this.user.balance += this.user.click_lvl;
        this.user.energy -= 1;
        
        ui.update();
        this.anim(e);

        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    },

    anim(e) {
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;

        const p = document.createElement('div');
        p.className = 'tap-pop';
        p.innerText = `+${this.user.click_lvl}`;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.position = 'fixed';
        p.style.transform = 'translate(-50%, -50%)';

        document.body.appendChild(p);
        setTimeout(() => p.remove(), 800);
    },

    async save() {
        if (!this.user) return;
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
    },

    startLoops() {
        setInterval(() => {
            if (!this.user) return;
            if (this.user.energy < this.user.max_energy) this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1.5);
            if (this.user.profit_hr > 0) this.user.balance += (this.user.profit_hr / 3600);
            ui.update();
        }, 1000);
        setInterval(() => this.save(), 10000);
    }
};
