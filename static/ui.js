const ui = {
    init() {
        console.log("🖥️ Интерфейс обновлен");
        this.update();
    },

    update() {
        if (typeof logic === 'undefined') return;

        // Баланс
        const bld = document.getElementById('balance');
        if (bld) bld.innerText = Math.floor(logic.user.balance).toLocaleString();

        // Полоска и текст энергии
        const engV = document.getElementById('eng-val');
        const engF = document.getElementById('eng-fill');
        if (engV && engF) {
            const current = Math.floor(logic.user.energy);
            engV.innerText = `${current}/${logic.user.max_energy}`;
            engF.style.width = (current / logic.user.max_energy * 100) + "%";
        }

        // Статы
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
                        <p>Добавляет +1 к силе клика</p>
                    </div>
                    <div class="upg-price">💰 1 000</div>
                </div>
                <div class="upgrade-card" onclick="ui.handleBuy('energy', 5000, 500)">
                    <div class="upg-info">
                        <small>MAX ENERGY</small>
                        <p>Добавляет +500 к лимиту энергии</p>
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
                        <small>NEURAL CHIP v1</small>
                        <p>Пассивный доход +100 в час</p>
                    </div>
                    <div class="upg-price" style="color:#00ffff;">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            content = `
                <div class="modal-header">${id.toUpperCase()}</div>
                <div style="padding:40px; color:#555;">In Development...</div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }

        const container = m.querySelector('.modal-content');
        if (container) container.innerHTML = content;
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
            // Обновляем текущую модалку, чтобы данные обновились
            this.openM(type === 'profit' ? 'mine' : 'boost'); 
        } else {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
            alert("Недостаточно Neural Pulse!");
        }
    },

    // Анимация тапа
    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop'; // Должно совпадать с CSS
        n.innerText = `+${logic.user.click_lvl}`;
        
        // Координаты точки нажатия
        const x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        
        n.style.left = x + "px";
        n.style.top = y + "px";
        
        document.body.appendChild(n);
        
        // Удаляем элемент через время анимации
        setTimeout(() => n.remove(), 800);
    }
};
