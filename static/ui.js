const ui = {
    init() {
        console.log("🖥️ Интерфейс инициализирован");
        this.update();
    },

    update() {
        if (typeof logic === 'undefined') return;

        const bld = document.getElementById('balance');
        if (bld) bld.innerText = Math.floor(logic.user.balance).toLocaleString();

        const engV = document.getElementById('eng-val');
        const engF = document.getElementById('eng-fill');
        if (engV && engF) {
            const cur = Math.floor(logic.user.energy);
            const max = logic.user.max_energy;
            engV.innerText = `${cur}/${max}`;
            engF.style.width = (cur / max * 100) + "%";
        }

        const tapV = document.getElementById('tap-val');
        if (tapV) tapV.innerText = "+" + logic.user.click_lvl;

        const profV = document.getElementById('profit-val');
        if (profV) profV.innerText = Math.floor(logic.user.profit).toLocaleString();
        
        const lvlV = document.getElementById('u-lvl');
        if (lvlV) lvlV.innerText = `LVL ${logic.user.level}`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        let content = "";
        if (id === 'boost') {
            content = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <div class="upg-info">
                        <small>MULTITAP (LVL ${logic.user.click_lvl})</small>
                        <p>Увеличивает доход за клик на +1</p>
                    </div>
                    <div class="upg-price">💰 1 000</div>
                </div>
                <div class="upgrade-card" onclick="ui.handleBuy('energy', 5000, 500)">
                    <div class="upg-info">
                        <small>MAX ENERGY</small>
                        <p>Лимит энергии +500</p>
                    </div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else if (id === 'mine') {
            content = `
                <div class="modal-header">MINING</div>
                <div class="upgrade-card" onclick="ui.handleBuy('profit', 5000, 100)">
                    <div class="upg-info">
                        <small>NEURAL CHIP v1</small>
                        <p>Доход в час +100</p>
                    </div>
                    <div class="upg-price" style="color:#00ffff;">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else {
            content = `<div class="modal-header">${id.toUpperCase()}</div><div style="padding:40px; color:#555;">Модуль в разработке...</div><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }

        const modalContent = m.querySelector('.modal-content');
        if (modalContent) modalContent.innerHTML = content;
        m.classList.add('active');
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    async handleBuy(type, cost, val) {
        const success = await logic.buyUpgrade(type, cost, val);
        if (success) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            this.openM(type === 'profit' ? 'mine' : 'boost'); 
        } else {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
            alert("Недостаточно средств!");
        }
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop'; // Соответствует твоему CSS
        n.innerText = `+${logic.user.click_lvl}`;
        
        // Используем clientX/Y для точного попадания по координатам окна
        const x = e.clientX || (e.touches ? e.touches[0].clientX : e.pageX);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : e.pageY);
        
        n.style.left = x + "px";
        n.style.top = y + "px";
        
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
