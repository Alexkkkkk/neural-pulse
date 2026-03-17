const logic = {
    state: {
        id: Telegram.WebApp.initDataUnsafe?.user?.id || "0",
        bal: 0, lvl: 1, eng: 1000, max: 1000,
        name: Telegram.WebApp.initDataUnsafe?.user?.first_name || "Agent",
        ava: Telegram.WebApp.initDataUnsafe?.user?.photo_url || ""
    },

    async init() {
        const r = await fetch(`/api/user/${this.state.id}?name=${encodeURIComponent(this.state.name)}&photo=${encodeURIComponent(this.state.ava)}`);
        const d = await r.json();
        this.state.bal = parseFloat(d.balance);
        this.state.lvl = d.click_lvl;
        this.state.eng = d.energy;
        this.state.max = d.max_energy;
        ui.update(this.state);
    },

    tap(e) {
        if(this.state.eng >= this.state.lvl) {
            this.state.bal += this.state.lvl;
            this.state.eng -= this.state.lvl;
            if(Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            e.target.style.transform = 'scale(0.95)';
            setTimeout(() => e.target.style.transform = 'scale(1)', 50);
            ui.update(this.state);
            this.save();
        }
    },

    save() {
        fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: this.state.id, balance: this.state.bal, energy: this.state.eng, max_energy: this.state.max, click_lvl: this.state.lvl })
        });
    },

    saveWallet(addr) {
        fetch('/api/save-wallet', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: this.state.id, wallet: addr }) });
    },

    async loadTop() {
        ui.openM('top');
        const r = await fetch('/api/top');
        const d = await r.json();
        document.getElementById('t-list').innerHTML = d.map((u, i) => `<div style="background:#0a0a0a; padding:15px; margin-top:10px; border-radius:12px;">#${i+1} ${u.username}: ${Math.floor(u.balance)}</div>`).join('');
    }
};
