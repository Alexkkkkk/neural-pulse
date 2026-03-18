const logic = {
    user: {
        userId: 0, balance: 0, energy: 1000, max_energy: 1000,
        click_lvl: 1, profit: 0, level: 1, username: "Agent"
    },

    init() {
        this.syncWithDB().then(() => {
            this.startPassiveIncome();
            this.setupListeners();
            if (window.ui) ui.init(); 
        });
    },

    setupListeners() {
        const target = document.getElementById('tap-target');
        if (target) {
            target.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.tap(e);
            });
        }
    },

    async syncWithDB() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tg = window.Telegram.WebApp.initDataUnsafe.user;
            this.user.userId = tg.id;
            this.user.username = tg.first_name || "Agent";
        }
        try {
            const ref = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
            const res = await fetch(`/api/user/${this.user.userId}?ref=${ref}`);
            if (res.ok) {
                const data = await res.json();
                this.user.balance = parseFloat(data.balance) || 0;
                this.user.energy = parseFloat(data.energy) || 1000;
                this.user.max_energy = parseInt(data.max_energy) || 1000;
                this.user.click_lvl = parseInt(data.click_lvl) || 1;
                this.user.profit = parseFloat(data.profit_hr) || 0;
                this.user.level = parseInt(data.lvl) || 1;
            }
        } catch (e) { console.warn("Sync Error"); }
    },

    async save() {
        if (!this.user.userId) return;
        await fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                userId: this.user.userId,
                balance: this.user.balance,
                energy: this.user.energy,
                max_energy: this.user.max_energy,
                click_lvl: this.user.click_lvl,
                profit_hr: this.user.profit,
                lvl: this.user.level
            })
        });
    },

    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            this.showClickAnim(e);
            if (window.ui) ui.update();
            if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    },

    startPassiveIncome() {
        setInterval(() => {
            let update = false;
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                update = true;
            }
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
                update = true;
            }
            if (update && window.ui) ui.update();
        }, 1000);
        setInterval(() => this.save(), 15000);
    },

    showClickAnim(e) {
        const x = e.clientX || (e.touches ? e.touches[0].clientX : window.innerWidth / 2);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : window.innerHeight / 2);
        const el = document.createElement('div');
        el.className = 'tap-pop';
        el.innerText = `+${this.user.click_lvl}`;
        el.style.cssText = `left:${x}px; top:${y}px; position:absolute; color:#00ffff; pointer-events:none; z-index:9999; font-weight:bold;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
};
window.onload = () => logic.init();
