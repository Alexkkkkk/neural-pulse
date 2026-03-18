const ui = {
    currentModal: null,

    init() {
        this.update();
        if (window.Telegram?.WebApp) {
            const tw = window.Telegram.WebApp;
            tw.expand();
            tw.BackButton.onClick(() => this.closeM());
        }
    },

    update() {
        if (!window.logic?.user) return;
        const u = logic.user;

        const el = (id, val) => {
            const t = document.getElementById(id);
            if (t) t.innerText = val;
        };

        el('balance', Math.floor(u.balance).toLocaleString('ru-RU'));
        el('u-lvl', `LVL ${u.level}`);
        el('profit-val', Math.floor(u.profit).toLocaleString('ru-RU'));
        el('tap-val', `+${u.click_lvl}`);
        el('eng-val', `${Math.floor(u.energy)}/${u.max_energy}`);

        const fill = document.getElementById('eng-fill');
        if (fill) fill.style.width = (u.energy / u.max_energy * 100) + '%';
    },

    openM(id) {
        if (this.currentModal) this.closeM();
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.show();
            this.render(id);
        }
    },

    closeM() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal = null;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.hide();
        }
    },

    render(id) {
        const cont = document.querySelector(`#m-${id} .modal-content`);
        if (!cont) return;
        const u = logic.user;
        let html = '';

        if (id === 'wallet') {
            html = `<h1>👛 WALLET</h1><div class="stat-card"><b>NOT CONNECTED</b></div>
                    <button class="back-btn" style="background:#00ffff" onclick="ui.alert('Soon!')">CONNECT</button>`;
        } else if (id === 'boost') {
            const p1 = u.click_lvl * 1000;
            const p2 = (u.max_energy / 500) * 1500;
            html = `<h1>🚀 BOOST</h1>
                    <div class="stat-card" onclick="ui.buy('tap', ${p1})"><small>TAP LVL ${u.click_lvl}</small><b>${p1.toLocaleString()}</b></div>
                    <div class="stat-card" onclick="ui.buy('energy', ${p2})"><small>ENERGY CAP</small><b>${p2.toLocaleString()}</b></div>`;
        } else if (id === 'mine') {
            html = `<h1>⛏️ MINE</h1>
                    <div class="stat-card" onclick="ui.buy('profit', 5000)"><small>NEURAL CHIP</small><b>5,000 (+100/hr)</b></div>`;
        } else if (id === 'top') {
            html = `<h1>🏆 TOP</h1><div class="stat-card"><span>1. ${u.username}</span><b>${Math.floor(u.balance).toLocaleString()}</b></div>`;
        } else {
            html = `<h1>${id.toUpperCase()}</h1><p>Coming soon...</p>`;
        }

        cont.innerHTML = html + `<button class="back-btn" onclick="ui.closeM()">BACK</button>`;
    },

    buy(type, price) {
        const u = logic.user;
        if (u.balance >= price) {
            u.balance -= price;
            if (type === 'tap') u.click_lvl++;
            if (type === 'energy') u.max_energy += 500;
            if (type === 'profit') u.profit += 100;
            logic.save();
            this.update();
            this.render(this.currentModal.id.replace('m-', ''));
            if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } else {
            this.alert("Insufficient funds!");
        }
    },

    alert(m) { window.Telegram?.WebApp ? Telegram.WebApp.showAlert(m) : alert(m); }
};
