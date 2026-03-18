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
        if (!window.logic || !logic.user) return;
        
        // Обновляем текст в элементах по их ID из твоего HTML
        const el = (id, val) => {
            const target = document.getElementById(id);
            if (target) target.innerText = val;
        };

        el('balance', Math.floor(logic.user.balance).toLocaleString('ru-RU'));
        el('u-lvl', `LVL ${logic.user.lvl || 1}`);
        el('profit-val', Math.floor(logic.user.profit_hr || 0).toLocaleString('ru-RU'));
        el('tap-val', `+${logic.user.click_lvl || 1}`);
        el('eng-val', `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`);

        const fill = document.getElementById('eng-fill');
        if (fill) {
            const pct = (logic.user.energy / logic.user.max_energy * 100) || 0;
            fill.style.width = pct + '%';
        }
    },

    openM(id) {
        if (this.currentModal) this.closeM();
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.show();
            
            // Запуск отрисовки контента
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

        let html = '';
        if (id === 'wallet') {
            html = `<h1>👛 WALLET</h1><p>Connect TON wallet</p>
                    <div class="stat-card"><b>NOT CONNECTED</b></div>
                    <button class="back-btn" style="background:#00ffff;color:#000" onclick="ui.alert('Soon!')">CONNECT</button>`;
        } else if (id === 'boost') {
            const p1 = (logic.user.click_lvl) * 1000;
            const p2 = (logic.user.max_energy / 500) * 1500;
            html = `<h1>🚀 BOOST</h1>
                    <div class="stat-card" onclick="ui.buy('tap', ${p1})"><small>TAP LVL ${logic.user.click_lvl}</small><b>${p1}</b></div>
                    <div class="stat-card" onclick="ui.buy('energy', ${p2})"><small>ENERGY CAP</small><b>${p2}</b></div>`;
        } else if (id === 'mine') {
            html = `<h1>⛏️ MINE</h1>
                    <div class="stat-card" onclick="ui.buy('profit', 5000)"><small>NEURAL CHIP</small><b>5,000 (+100/hr)</b></div>`;
        } else if (id === 'squad') {
            html = `<h1>🤝 SQUAD</h1><p>Invite friends</p><button class="back-btn" onclick="ui.copy('https://t.me/bot')">COPY LINK</button>`;
        } else if (id === 'top') {
            html = `<h1>🏆 TOP</h1><div class="stat-card"><span>1. Agent</span><b>${Math.floor(logic.user.balance)}</b></div>`;
        } else if (id === 'tasks') {
            html = `<h1>📋 TASKS</h1><div class="stat-card" onclick="ui.alert('Comming soon')"><b>Subscribe Channel</b></div>`;
        }

        cont.innerHTML = html + `<button class="back-btn" onclick="ui.closeM()" style="margin-top:20px">BACK</button>`;
    },

    buy(type, price) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            if (type === 'tap') logic.user.click_lvl++;
            if (type === 'energy') logic.user.max_energy += 500;
            if (type === 'profit') logic.user.profit_hr += 100;
            logic.save();
            this.update();
            this.render(this.currentModal.id.replace('m-', ''));
            if (window.Telegram?.WebApp?.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } else {
            this.alert("No money!");
        }
    },

    alert(m) { window.Telegram?.WebApp ? Telegram.WebApp.showAlert(m) : alert(m); },
    copy(t) { navigator.clipboard.writeText(t); this.alert("Copied!"); }
};
