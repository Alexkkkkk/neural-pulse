const ui = {
    init() {
        const target = document.getElementById('tap-target');
        if (target) {
            const newTarget = target.cloneNode(true);
            target.replaceWith(newTarget);

            const handleTap = (e) => {
                e.preventDefault();
                const pos = e.touches ? e.touches[0] : e;
                logic.tap({ clientX: pos.clientX, clientY: pos.clientY });
            };

            newTarget.addEventListener('touchstart', handleTap, { passive: false });
            newTarget.addEventListener('mousedown', handleTap);
        }
        this.update();
    },

    update() {
        if (!logic.user) return;
        const u = logic.user;
        const set = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };

        set('balance', Math.floor(u.balance).toLocaleString('ru-RU'));
        set('tap-val', `+${u.click_lvl}`);
        set('profit-val', Math.floor(u.profit_hr).toLocaleString('ru-RU'));
        set('u-lvl', `LVL ${u.lvl}`);
        set('eng-val', `${Math.floor(u.energy)}/${u.max_energy}`);

        const fill = document.getElementById('eng-fill');
        if (fill) fill.style.width = `${(u.energy / u.max_energy) * 100}%`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;
        m.classList.add('active');
        const container = m.querySelector('.modal-content');

        if (id === 'wallet') {
            container.innerHTML = `<div class="modal-header">TON WALLET</div><div style="padding:20px; text-align:center;"><div id="ton-connect-btn"></div></div><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else if (id === 'mine') {
            container.innerHTML = `<div class="modal-header">MINING</div>
                <div class="upgrade-card" onclick="ui.buyUpg('cpu', 500, 100, 'mine')">
                    <b>Neural CPU</b><br><small>+100/hr</small><div class="price-tag">💰 500</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else {
            container.innerHTML = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center;">COMING SOON</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }
    },

    buyUpg(id, price, val, type) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            if (type === 'mine') logic.user.profit_hr += val;
            if (type === 'boost') logic.user.click_lvl += val;
            this.update();
            this.openM(type);
        }
    },

    closeM() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        n.style.left = `${e.clientX}px`;
        n.style.top = `${e.clientY}px`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
