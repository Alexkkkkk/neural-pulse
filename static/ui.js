const ui = {
    init() {
        const target = document.getElementById('tap-target');
        if (target) {
            target.addEventListener('pointerdown', (e) => {
                logic.tap();
            });
        }
        this.update();
    },

    update() {
        if (!logic.user) return;
        const u = logic.user;
        
        // Обновляем основные показатели
        document.getElementById('balance').innerText = Math.floor(u.balance).toLocaleString('ru-RU');
        document.getElementById('tap-val').innerText = `+${u.click_lvl}`;
        document.getElementById('profit-val').innerText = Math.floor(u.profit_hr).toLocaleString('ru-RU');
        document.getElementById('u-lvl').innerText = `LVL ${u.lvl}`;
        document.getElementById('u-name').innerText = u.username;
        
        // Энергия
        const engPct = (u.energy / u.max_energy) * 100;
        document.getElementById('eng-val').innerText = `${Math.floor(u.energy)}/${u.max_energy}`;
        document.getElementById('eng-fill').style.width = `${engPct}%`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;

        let content = "";
        const u = logic.user;

        if (id === 'top') {
            content = `
                <div class="modal-header" style="color:var(--accent); font-weight:bold;">GLOBAL TOP</div>
                <div class="upgrade-card" style="border: 1px solid var(--accent); background: rgba(0, 255, 242, 0.05);">
                    <div class="upg-info"><b>1. ${u.username} (You)</b></div>
                    <div class="upg-price">${Math.floor(u.balance).toLocaleString()} 💰</div>
                </div>
                <div class="upgrade-card" style="opacity:0.6;">
                    <div class="upg-info">2. Neural_Master</div>
                    <div class="upg-price">50 000 💰</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'wallet') {
            content = `
                <div class="modal-header">WALLET</div>
                <div style="text-align:center; padding: 20px;">
                    <p style="font-size:12px; color:#888;">Адрес: ${u.wallet || 'Не подключен'}</p>
                    <button class="back-btn" style="background:var(--accent); color:#000; width:100%; margin-top:10px;">CONNECT TON</button>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'boost') {
            content = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <div class="upg-info"><b>Multitap</b><br><small>Level ${u.click_lvl}</small></div>
                    <div class="upg-price">1 000 💰</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            content = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; padding:20px;">Soon...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }

        m.querySelector('.modal-content').innerHTML = content;
        m.classList.add('active');
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    async handleBuy(t, c, v) {
        if (await logic.buyUpgrade(t, c, v)) {
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            this.openM('boost');
        } else {
            alert("Недостаточно средств!");
        }
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        const x = e?.clientX || window.innerWidth / 2;
        const y = e?.clientY || window.innerHeight / 2;
        n.style.left = `${x}px`;
        n.style.top = `${y}px`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
