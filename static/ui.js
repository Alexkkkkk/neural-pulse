const ui = {
    currentModal: null,

    init() {
        this.update();
    },

    update() {
        const u = logic.user;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

        set('balance', Math.floor(u.balance).toLocaleString('ru-RU'));
        set('u-lvl', `LVL ${u.level}`);
        set('profit-val', Math.floor(u.profit).toLocaleString('ru-RU'));
        set('tap-val', `+${u.click_lvl}`);
        set('eng-val', `${Math.floor(u.energy)}/${u.max_energy}`);

        const fill = document.getElementById('eng-fill');
        if (fill) fill.style.width = (u.energy / u.max_energy * 100) + '%';
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            this.render(id);
        }
    },

    closeM() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal = null;
        }
    },

    render(id) {
        const mBody = document.querySelector(`#m-${id} .modal-content`);
        if (!mBody) return;
        const u = logic.user;
        let html = `<h1>${id.toUpperCase()}</h1>`;

        if (id === 'boost') {
            const p1 = u.click_lvl * 1000;
            const p2 = (u.max_energy / 500) * 1500;
            html += `<div class="stat-card" onclick="ui.buy('tap', ${p1})">
                        <small>UPGRADE TAP (LVL ${u.click_lvl})</small><b>${p1.toLocaleString()}</b>
                     </div>
                     <div class="stat-card" onclick="ui.buy('energy', ${p2})">
                        <small>MAX ENERGY</small><b>${p2.toLocaleString()}</b>
                     </div>`;
        } else if (id === 'mine') {
            html += `<div class="stat-card" onclick="ui.buy('profit', 5000)">
                        <small>NEURAL CHIP</small><b>5,000 (+100/hr)</b>
                     </div>`;
        } else if (id === 'top') {
            html += `<div class="stat-card"><span>1. ${u.username}</span><b>${Math.floor(u.balance).toLocaleString()}</b></div>`;
        }

        mBody.innerHTML = html + `<button class="back-btn" onclick="ui.closeM()">BACK</button>`;
    },

    buy(type, price) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            if (type === 'tap') logic.user.click_lvl++;
            if (type === 'energy') logic.user.max_energy += 500;
            if (type === 'profit') logic.user.profit += 100;
            
            logic.save();
            this.update();
            this.render(this.currentModal.id.replace('m-', ''));
        } else {
            this.alert("Insufficient Pulse!");
        }
    },

    anim(e) {
        const x = e.clientX || (e.touches ? e.touches[0].clientX : window.innerWidth / 2);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : window.innerHeight / 2);
        const el = document.createElement('div');
        el.className = 'tap-pop';
        el.innerText = `+${logic.user.click_lvl}`;
        el.style.cssText = `left:${x}px; top:${y}px; position:absolute; color:#00ffff; pointer-events:none; z-index:9999; font-weight:bold; animation: fadeUp 0.8s ease-out;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    },

    alert(m) { window.Telegram?.WebApp ? Telegram.WebApp.showAlert(m) : alert(m); }
};
