const ui = {
    init() {
        console.log("🖥️ Интерфейс готов");
    },

    update() {
        // Обновляем баланс и статы на главном экране
        const bld = document.getElementById('balance');
        if (bld) bld.innerText = Math.floor(logic.user.balance).toLocaleString();

        const engV = document.getElementById('eng-val');
        const engF = document.getElementById('eng-fill');
        if (engV && engF) {
            engV.innerText = `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`;
            engF.style.width = (logic.user.energy / logic.user.max_energy * 100) + "%";
        }

        const tapV = document.getElementById('tap-val');
        if (tapV) tapV.innerText = "+" + logic.user.click_lvl;

        const profV = document.getElementById('profit-val');
        if (profV) profV.innerText = Math.floor(logic.user.profit);
        
        const lvlV = document.getElementById('u-lvl');
        if (lvlV) lvlV.innerText = `LVL ${logic.user.level}`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        let content = "";
        
        // Генерируем контент в зависимости от окна
        if (id === 'boost') {
            content = `
                <div class="modal-header">BOOST</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <small>UPGRADE TAP (LVL ${logic.user.click_lvl})</small>
                    <b>1 000</b>
                </div>
                <div class="upgrade-card" onclick="ui.handleBuy('energy', 5000, 500)">
                    <small>MAX ENERGY</small>
                    <b>5 000</b>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'mine') {
            content = `
                <div class="modal-header">MINE</div>
                <div class="upgrade-card" onclick="ui.handleBuy('profit', 5000, 100)">
                    <small>NEURAL CHIP</small>
                    <b style="color: #00f2ff;">5 000 (+100/hr)</b>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            content = `<div class="modal-header">${id.toUpperCase()}</div><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }

        m.querySelector('.modal-content').innerHTML = content;
        m.classList.add('active');
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    async handleBuy(type, cost, val) {
        const success = await logic.buyUpgrade(type, cost, val);
        if (success) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            this.openM(type === 'profit' ? 'mine' : 'boost'); // Обновляем текст в модалке
        } else {
            alert("Insufficient Pulse!");
        }
    },

    anim(e) {
        // Логика вылетающих цифр +1, +2...
        const n = document.createElement('div');
        n.className = 'tap-anim';
        n.innerText = `+${logic.user.click_lvl}`;
        n.style.left = e.pageX + "px";
        n.style.top = e.pageY + "px";
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
