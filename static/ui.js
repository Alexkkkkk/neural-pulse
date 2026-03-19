const ui = {
    init() {
        const target = document.getElementById('tap-target');
        if (target) {
            // Используем touchstart для мгновенного отклика в Telegram
            target.onclick = (e) => {
                e.preventDefault();
                logic.tap(e);
            };
        }
        this.update();
    },

    update() {
        if (!logic.user) return;
        const u = logic.user;
        
        // Обновление основных показателей
        const balanceEl = document.getElementById('balance');
        if (balanceEl) balanceEl.innerText = Math.floor(u.balance).toLocaleString('ru-RU');
        
        const tapValEl = document.getElementById('tap-val');
        if (tapValEl) tapValEl.innerText = `+${u.click_lvl}`;
        
        const profitEl = document.getElementById('profit-val');
        if (profitEl) profitEl.innerText = Math.floor(u.profit_hr).toLocaleString('ru-RU');
        
        const lvlEl = document.getElementById('u-lvl');
        if (lvlEl) lvlEl.innerText = `LVL ${u.lvl}`;

        // Энергия
        const engPct = (u.energy / u.max_energy) * 100;
        const engValEl = document.getElementById('eng-val');
        if (engValEl) engValEl.innerText = `${Math.floor(u.energy)}/${u.max_energy}`;
        
        const engFillEl = document.getElementById('eng-fill');
        if (engFillEl) engFillEl.style.width = `${engPct}%`;
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
                    <p style="text-align:center; font-size:14px; opacity:0.8;">Подключите кошелек для синхронизации.</p>
                    <div id="ton-connect-btn"></div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            content = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; padding:30px; opacity:0.5;">Скоро открытие...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
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
        
        // Координаты клика или центр экрана
        const x = e.clientX || window.innerWidth / 2;
        const y = e.clientY || window.innerHeight / 2;
        
        n.style.left = `${x}px`;
        n.style.top = `${y}px`;
        
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
