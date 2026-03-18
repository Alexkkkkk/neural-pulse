const ui = {
    init() {
        console.log("🖥️ Интерфейс инициализирован");
        this.update();
    },

    update() {
        if (typeof logic === 'undefined') return;

        const bld = document.getElementById('balance');
        if (bld) bld.innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');

        const engV = document.getElementById('eng-val');
        const engF = document.getElementById('eng-fill');
        if (engV && engF) {
            const currentEng = Math.floor(logic.user.energy);
            const maxEng = logic.user.max_energy;
            engV.innerText = `${currentEng}/${maxEng}`;
            engF.style.width = (currentEng / maxEng * 100) + "%";
        }

        const tapV = document.getElementById('tap-val');
        if (tapV) tapV.innerText = "+" + logic.user.click_lvl;

        const profV = document.getElementById('profit-val');
        if (profV) profV.innerText = Math.floor(logic.user.profit).toLocaleString('ru-RU');
        
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
                        <p>+1 к силе клика</p>
                    </div>
                    <div class="upg-price">💰 1 000</div>
                </div>
                <div class="upgrade-card" onclick="ui.handleBuy('energy', 5000, 500)">
                    <div class="upg-info">
                        <small>MAX ENERGY</small>
                        <p>+500 к лимиту энергии</p>
                    </div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else if (id === 'mine') {
            content = `
                <div class="modal-header">MINING RIGS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('profit', 5000, 100)">
                    <div class="upg-info">
                        <small>NEURAL CHIP v1</small>
                        <p>Пассивный доход +100/час</p>
                    </div>
                    <div class="upg-price" style="color: #00f2ff;">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else {
            content = `<div class="modal-header">${id.toUpperCase()}</div><div style="padding: 40px; text-align:center; color: #888;">В разработке...</div><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
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
            alert("Недостаточно Neural Pulse!");
        }
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        
        const x = e.clientX || (e.touches && e.touches.length > 0 ? e.touches[0].clientX : window.innerWidth / 2);
        const y = e.clientY || (e.touches && e.touches.length > 0 ? e.touches[0].clientY : window.innerHeight / 2);
        
        n.style.left = (x - 15) + "px";
        n.style.top = y + "px";
        
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
