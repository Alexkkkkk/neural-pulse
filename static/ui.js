const ui = {
    init() {
        console.log("🖥️ [UI] Интерфейс инициализирован");
        const firstNav = document.querySelector('.bottom-nav .nav-btn');
        if (firstNav) firstNav.classList.add('active');
        this.update();
    },

    update() {
        if (typeof logic === 'undefined' || !logic.user) return;

        try {
            const balanceEl = document.getElementById('balance');
            if (balanceEl) balanceEl.innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');

            const tapValEl = document.getElementById('tap-val');
            if (tapValEl) tapValEl.innerText = "+" + logic.user.click_lvl;

            const profitValEl = document.getElementById('profit-val');
            if (profitValEl) profitValEl.innerText = Math.floor(logic.user.profit_hr).toLocaleString('ru-RU');

            const lvlEl = document.getElementById('u-lvl');
            if (lvlEl) lvlEl.innerText = `LVL ${logic.user.lvl}`;

            const currentEng = Math.floor(logic.user.energy);
            const maxEng = logic.user.max_energy;
            const engValEl = document.getElementById('eng-val');
            const engFillEl = document.getElementById('eng-fill');

            if (engValEl) engValEl.innerText = `${currentEng}/${maxEng}`;
            if (engFillEl) engFillEl.style.width = (currentEng / maxEng * 100) + "%";

        } catch (err) {
            console.error("❌ [UI UPDATE ERROR]", err);
        }
    },

    openM(id) {
        // Убираем активный класс у всех кнопок
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => btn.classList.remove('active'));
        
        // Подсвечиваем кнопку, если вызов был из навигации
        if (window.event && window.event.currentTarget) {
            const clickedBtn = window.event.currentTarget;
            if (clickedBtn.classList.contains('nav-btn')) {
                clickedBtn.classList.add('active');
            }
        }

        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        let content = "";
        if (id === 'boost') {
            content = `
                <div class="modal-header" style="text-align:center; font-weight:bold; margin-bottom:15px; color:var(--accent);">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <div class="upg-info"><small>MULTITAP (LVL ${logic.user.click_lvl})</small><p style="font-size:11px; color:#666; margin:5px 0 0 0;">+1 к силе клика</p></div>
                    <div class="upg-price">💰 1 000</div>
                </div>
                <div class="upgrade-card" onclick="ui.handleBuy('energy', 5000, 500)">
                    <div class="upg-info"><small>MAX ENERGY</small><p style="font-size:11px; color:#666; margin:5px 0 0 0;">+500 к лимиту</p></div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else {
            content = `<div class="modal-header" style="text-align:center; padding:20px;">${id.toUpperCase()}</div><p style="text-align:center;color:#555">Soon...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }

        const container = m.querySelector('.modal-content');
        if (container) {
            container.innerHTML = content;
            m.classList.add('active');
        }
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    async handleBuy(type, cost, val) {
        if (typeof logic.buyUpgrade !== 'function') return;
        const success = await logic.buyUpgrade(type, cost, val);
        if (success) {
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            this.openM('boost'); 
        } else {
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            alert("Недостаточно Neural Pulse!");
        }
    },

    anim(e) {
        const target = document.getElementById('tap-target');
        if (!target) return;
        
        const rect = target.getBoundingClientRect();
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        
        // Координаты: если есть событие e (клики/тапы), берем их, иначе центр
        let x, y;
        if (e && (e.clientX || (e.touches && e.touches[0]))) {
            x = e.clientX || e.touches[0].clientX;
            y = e.clientY || e.touches[0].clientY;
        } else {
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }
        
        n.style.left = (x - 15) + "px";
        n.style.top = (y - 30) + "px";
        
        document.body.appendChild(n);
        setTimeout(() => { if (n.parentNode) n.remove(); }, 800);
    }
};
