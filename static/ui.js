const ui = {
    update() {
        if (typeof logic === 'undefined' || !logic.user) return;

        // Обновляем баланс (с округлением вниз)
        const balEl = document.getElementById('balance');
        if (balEl) balEl.innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');

        // Энергия
        const engVal = document.getElementById('eng-val');
        const engFill = document.getElementById('eng-fill');
        if (engVal) engVal.innerText = `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`;
        if (engFill) engFill.style.width = (logic.user.energy / logic.user.max_energy * 100) + "%";

        // Статы
        const tapEl = document.getElementById('tap-val');
        if (tapEl) tapEl.innerText = "+" + logic.user.click_lvl;

        const profitEl = document.getElementById('profit-val');
        if (profitEl) profitEl.innerText = Math.floor(logic.user.profit).toLocaleString('ru-RU');
        
        const lvlEl = document.getElementById('u-lvl');
        if (lvlEl) lvlEl.innerText = `LVL ${logic.user.level}`;
    },

    openM(id) {
        const modal = document.getElementById('m-' + id);
        if (!modal) return;

        let content = "";
        if (id === 'boost') {
            content = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <div class="upg-info">
                        <b>MULTITAP (LVL ${logic.user.click_lvl})</b>
                        <small>+1 к силе клика</small>
                    </div>
                    <div class="upg-price">💰 1 000</div>
                </div>
                <div class="upgrade-card" onclick="ui.handleBuy('energy', 5000, 500)">
                    <div class="upg-info">
                        <b>MAX ENERGY</b>
                        <small>+500 к лимиту</small>
                    </div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'mine') {
            content = `
                <div class="modal-header">MINING</div>
                <div class="upgrade-card" onclick="ui.handleBuy('profit', 5000, 100)">
                    <div class="upg-info">
                        <b>NEURAL CORE</b>
                        <small>+100 прибыли в час</small>
                    </div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            content = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; padding:20px; color:#666;">Soon...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }

        const inner = modal.querySelector('.modal-content');
        if (inner) {
            inner.innerHTML = content;
            modal.classList.add('active');
        }
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    async handleBuy(type, cost, val) {
        const ok = await logic.buyUpgrade(type, cost, val);
        if (ok) {
            this.openM(type === 'profit' ? 'mine' : 'boost'); // Обновляем текущее окно
        } else {
            if (window.Telegram?.WebApp) window.Telegram.WebApp.showAlert("Недостаточно средств!");
            else alert("Need more money!");
        }
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        let x = e.clientX || (e.touches ? e.touches[0].clientX : window.innerWidth / 2);
        let y = e.clientY || (e.touches ? e.touches[0].clientY : window.innerHeight / 2);
        n.style.left = (x - 15) + "px";
        n.style.top = (y - 20) + "px";
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
