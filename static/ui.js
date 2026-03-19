const ui = {
    init() {
        const target = document.getElementById('tap-target');
        if (target) {
            target.onclick = (e) => logic.tap();
        }
        this.update();
    },

    update() {
        if (!logic.user) return;
        const u = logic.user;
        document.getElementById('balance').innerText = Math.floor(u.balance).toLocaleString('ru-RU');
        document.getElementById('tap-val').innerText = `+${u.click_lvl}`;
        document.getElementById('profit-val').innerText = Math.floor(u.profit_hr).toLocaleString('ru-RU');
        document.getElementById('u-lvl').innerText = `LVL ${u.lvl}`;
        document.getElementById('u-name').innerText = u.username || "Agent";
        
        const engPct = (u.energy / u.max_energy) * 100;
        document.getElementById('eng-val').innerText = `${Math.floor(u.energy)}/${u.max_energy}`;
        document.getElementById('eng-fill').style.width = `${engPct}%`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;

        let content = "";
        if (id === 'wallet') {
            content = `
                <div class="modal-header">TON WALLET</div>
                <div style="display:flex; flex-direction:column; align-items:center; padding:20px; gap:15px;">
                    <div style="font-size:40px;">💎</div>
                    <p style="text-align:center; font-size:14px; opacity:0.8;">Подключите кошелек для получения бонусов.</p>
                    <div id="ton-connect-btn"></div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            content = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; padding:30px; opacity:0.5;">Coming Soon...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }

        m.querySelector('.modal-content').innerHTML = content;
        m.classList.add('active');

        if (id === 'wallet' && logic.tonConnectUI) {
            logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
        }
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        n.style.left = `${e.clientX || window.innerWidth/2}px`;
        n.style.top = `${e.clientY || window.innerHeight/2}px`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
