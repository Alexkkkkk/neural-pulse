const logic = {
    user: {
        userId: 0,
        balance: 0,
        energy: 1000,
        max_energy: 1000,
        click_lvl: 1, // Единое имя для уровня тапа
        profit: 0,
        level: 1,
        ref_count: 0,
        username: "Agent"
    },

    init() {
        this.syncWithDB().then(() => {
            this.startPassiveIncome();
            this.setupListeners();
            if (window.ui) ui.init(); 
        });
        console.log("Neural Pulse Core v3.8.0 Stable Loaded");
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
            const nameEl = document.getElementById('u-name');
            if (nameEl) nameEl.innerText = this.user.username;
        }

        try {
            const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
            const res = await fetch(`/api/user/${this.user.userId}?ref=${startParam}`);
            if (res.ok) {
                const data = await res.json();
                // Синхронизация с БД + защита от пустых значений
                this.user.balance = parseFloat(data.balance) || 0;
                this.user.energy = parseFloat(data.energy) || 1000;
                this.user.max_energy = parseInt(data.max_energy) || 1000;
                this.user.click_lvl = parseInt(data.click_lvl || data.tap_val) || 1;
                this.user.profit = parseFloat(data.profit_hr || data.profit) || 0;
                this.user.level = parseInt(data.lvl || data.level) || 1;
            }
        } catch (e) { console.warn("Offline mode active."); }
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
                    click_lvl: this.user.click_lvl,
                    profit_hr: this.user.profit,
                    lvl: this.user.level
                })
            });
        } catch (e) { }
    },

    tap(e) {
        if (this.user.energy >= this.user.click_lvl) {
            this.user.balance += this.user.click_lvl;
            this.user.energy -= this.user.click_lvl;
            this.showClickAnim(e);
            if (window.ui) ui.update();
            this.checkLevelUp();
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        }
    },

    startPassiveIncome() {
        setInterval(() => {
            let needsUpdate = false;
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
                needsUpdate = true;
            }
            if (this.user.profit > 0) {
                this.user.balance += (this.user.profit / 3600);
                needsUpdate = true;
            }
            if (needsUpdate && window.ui) ui.update();
        }, 1000);
        setInterval(() => this.save(), 20000);
    },

    checkLevelUp() {
        const threshold = this.user.level * 500000; 
        if (this.user.balance >= threshold) {
            this.user.level++;
            if (window.Telegram?.WebApp) Telegram.WebApp.showAlert(`LVL UP! Уровень ${this.user.level}`);
            if (window.ui) ui.update();
        }
    },

    showClickAnim(e) {
        const x = e.clientX || (e.touches ? e.touches[0].clientX : window.innerWidth / 2);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : window.innerHeight / 2);
        const el = document.createElement('div');
        el.className = 'tap-pop';
        el.innerText = `+${this.user.click_lvl}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
};
window.onload = () => logic.init();
