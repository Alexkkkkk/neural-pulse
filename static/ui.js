const ui = {
    init() {
        console.log("🖥️ [UI] Интерфейс инициализирован");
        this.update();
    },

    update() {
        if (typeof logic === 'undefined' || !logic.user) return;

        try {
            // Принудительное обновление текста баланса
            const balanceEl = document.getElementById('balance');
            if (balanceEl) {
                const currentBalance = Math.floor(logic.user.balance || 0);
                balanceEl.innerText = currentBalance.toLocaleString('ru-RU');
            }

            const tapValEl = document.getElementById('tap-val');
            if (tapValEl) tapValEl.innerText = "+" + (logic.user.click_lvl || 1);

            const profitValEl = document.getElementById('profit-val');
            if (profitValEl) profitValEl.innerText = Math.floor(logic.user.profit || 0).toLocaleString('ru-RU');

            const lvlEl = document.getElementById('u-lvl');
            if (lvlEl) lvlEl.innerText = `LVL ${logic.user.level || 1}`;

            // Энергия
            const currentEng = Math.floor(logic.user.energy || 0);
            const maxEng = logic.user.max_energy || 1000;
            const engValEl = document.getElementById('eng-val');
            const engFillEl = document.getElementById('eng-fill');

            if (engValEl) engValEl.innerText = `${currentEng}/${maxEng}`;
            if (engFillEl) engFillEl.style.width = (currentEng / maxEng * 100) + "%";

            // Лайки
            const likeIcon = document.getElementById('like-icon');
            const likeCnt = document.getElementById('like-count');
            if (likeIcon && likeCnt) {
                likeIcon.innerText = logic.user.isLiked ? "❤️" : "🤍";
                likeCnt.innerText = logic.user.likes || 0;
            }
        } catch (err) {
            console.error("❌ [UI UPDATE ERROR]", err);
        }
    },

    toggleLike(e) {
        if (e) e.stopPropagation();
        if (typeof logic.toggleLike === 'function') logic.toggleLike();
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        let content = "";
        if (id === 'boost') {
            content = `
                <div class="modal-header" style="text-align:center; font-weight:bold; margin-bottom:15px; color:#00f2ff;">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <div class="upg-info"><small>MULTITAP (LVL ${logic.user.click_lvl})</small><p style="font-size:11px; color:#aaa; margin:5px 0 0 0;">+1 к силе клика</p></div>
                    <div class="upg-price">💰 1 000</div>
                </div>
                <div class="upgrade-card" onclick="ui.handleBuy('energy', 5000, 500)">
                    <div class="upg-info"><small>MAX ENERGY</small><p style="font-size:11px; color:#aaa; margin:5px 0 0 0;">+500 к лимиту</p></div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else if (id === 'mine') {
            content = `
                <div class="modal-header" style="text-align:center; font-weight:bold; margin-bottom:15px; color:#00f2ff;">MINING</div>
                <div class="upgrade-card" onclick="ui.handleBuy('profit', 5000, 100)">
                    <div class="upg-info"><small>NEURAL CHIP v1</small><p style="font-size:11px; color:#aaa; margin:5px 0 0 0;">Пассивный доход +100/час</p></div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else {
            content = `<div class="modal-header" style="text-align:center; padding:20px;">${id.toUpperCase()}</div><p style="text-align:center;color:#888">Coming Soon...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
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
            this.openM(type === 'profit' ? 'mine' : 'boost'); 
        } else {
            alert("Недостаточно средств!");
        }
    },

    anim(e) {
        if (!e) return;
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        
        let x = e.clientX || (e.touches ? e.touches[0].clientX : window.innerWidth / 2);
        let y = e.clientY || (e.touches ? e.touches[0].clientY : window.innerHeight / 2);
        
        n.style.left = (x - 15) + "px";
        n.style.top = (y - 20) + "px";
        document.body.appendChild(n);
        setTimeout(() => { if (n.parentNode) n.remove(); }, 800);
    }
};
