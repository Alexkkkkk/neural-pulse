const ui = {
    init() {
        console.log("🖥️ Интерфейс инициализирован");
        this.update();
    },

    update() {
        if (typeof logic === 'undefined') return;

        // Обновление баланса и основных статов
        document.getElementById('balance').innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');
        document.getElementById('tap-val').innerText = "+" + logic.user.click_lvl;
        document.getElementById('profit-val').innerText = Math.floor(logic.user.profit).toLocaleString('ru-RU');
        document.getElementById('u-lvl').innerText = `LVL ${logic.user.level}`;

        // Обновление энергии
        const currentEng = Math.floor(logic.user.energy);
        const maxEng = logic.user.max_energy;
        document.getElementById('eng-val').innerText = `${currentEng}/${maxEng}`;
        document.getElementById('eng-fill').style.width = (currentEng / maxEng * 100) + "%";

        // Обновление лайка
        const likeIcon = document.getElementById('like-icon');
        const likeCnt = document.getElementById('like-count');
        const likeBox = document.querySelector('.like-container');
        
        if (logic.user.isLiked) {
            likeIcon.innerText = "❤️";
            likeBox.classList.add('active');
        } else {
            likeIcon.innerText = "🤍";
            likeBox.classList.remove('active');
        }
        likeCnt.innerText = logic.user.likes;
    },

    toggleLike(e) {
        e.stopPropagation();
        logic.toggleLike();
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    },

    openM(id) {
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
        } else if (id === 'mine') {
            content = `
                <div class="modal-header" style="text-align:center; font-weight:bold; margin-bottom:15px; color:var(--accent);">MINING</div>
                <div class="upgrade-card" onclick="ui.handleBuy('profit', 5000, 100)">
                    <div class="upg-info"><small>NEURAL CHIP v1</small><p style="font-size:11px; color:#666; margin:5px 0 0 0;">Пассивный доход +100/час</p></div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else {
            content = `<div class="modal-header" style="text-align:center; padding:20px;">${id.toUpperCase()}</div><p style="text-align:center;color:#555">Soon...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
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
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            this.openM(type === 'profit' ? 'mine' : 'boost'); 
        } else {
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
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
        n.style.top = (y - 20) + "px";
        
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
