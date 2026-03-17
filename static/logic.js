const logic = {
    state: {
        id: window.Telegram.WebApp.initDataUnsafe?.user?.id || "0",
        bal: 0, lvl: 1, 
        name: window.Telegram.WebApp.initDataUnsafe?.user?.first_name || "Agent",
        ava: window.Telegram.WebApp.initDataUnsafe?.user?.photo_url || ""
    },

    async start() {
        const r = await fetch(`/api/user/${this.state.id}?name=${encodeURIComponent(this.state.name)}&photo=${encodeURIComponent(this.state.ava)}`);
        const d = await r.json();
        this.state.bal = parseFloat(d.balance);
        this.state.lvl = d.click_lvl;
        ui.render(this.state);
    },

    tap(e) {
        this.state.bal += this.state.lvl;
        if(window.Telegram.WebApp.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        
        e.target.style.transform = 'scale(0.95)';
        setTimeout(() => e.target.style.transform = 'scale(1)', 50);
        
        ui.render(this.state);
        this.save();
    },

    save() {
        fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: this.state.id, balance: this.state.bal, click_lvl: this.state.lvl })
        });
    },

    async loadTop() {
        const r = await fetch('/api/top');
        const d = await r.json();
        document.getElementById('t-list').innerHTML = d.map((u, i) => `
            <div style="background:#0a0a0a; padding:15px; margin-top:10px; border-radius:12px; display:flex; justify-content:space-between;">
                <b>#${i+1} ${u.username}</b> <span>${Math.floor(u.balance)}</span>
            </div>`).join('');
    }
};
