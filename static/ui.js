const ui = {
    init() {
        console.log("🖥️ [UI] Интерфейс инициализирован");
        this.update();
    },

    update() {
        // Если логика еще не загрузилась, выходим, чтобы не было ошибок
        if (typeof logic === 'undefined' || !logic.user) return;

        try {
            // Обновление баланса и основных статов
            const balanceEl = document.getElementById('balance');
            if (balanceEl) {
                balanceEl.innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');
            }

            const tapValEl = document.getElementById('tap-val');
            if (tapValEl) {
                tapValEl.innerText = "+" + logic.user.click_lvl;
            }

            const profitValEl = document.getElementById('profit-val');
            if (profitValEl) {
                profitValEl.innerText = Math.floor(logic.user.profit).toLocaleString('ru-RU');
            }

            const lvlEl = document.getElementById('u-lvl');
            if (lvlEl) {
                lvlEl.innerText = `LVL ${logic.user.level}`;
            }

            // Обновление энергии
            const currentEng = Math.floor(logic.user.energy);
            const maxEng = logic.user.max_energy;
            const engValEl = document.getElementById('eng-val');
            const engFillEl = document.getElementById('eng-fill');

            if (engValEl) engValEl.innerText = `${currentEng}/${maxEng}`;
            if (engFillEl) engFillEl.style.width = (currentEng / maxEng * 100) + "%";

            // Обновление лайка
            const likeIcon = document.getElementById('like-icon');
            const likeCnt = document.getElementById('like-count');
            const likeBox = document.querySelector('.like-container');
            
            if (likeIcon && likeCnt) {
                if (logic.user.isLiked) {
                    likeIcon.innerText = "❤️";
                    if (likeBox) likeBox.classList.add('active');
                } else {
                    likeIcon.innerText = "🤍";
                    if (likeBox) likeBox.classList.remove('active');
                }
                likeCnt.innerText = logic.user.likes || 0;
            }
        } catch (err) {
            console.error("❌ [UI UPDATE ERROR]", err);
        }
    },

    toggleLike(e) {
        if (e) e.stopPropagation();
        // Вызываем метод из logic.js
        if (typeof logic.toggleLike === 'function') {
            logic.toggleLike();
        }
        
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
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            // Перерисовываем модалку с новыми данными
            this.openM(type === 'profit' ? 'mine' : 'boost'); 
        } else {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
            alert("Недостаточно Neural Pulse!");
        }
    },

    anim(e) {
        if (!e) return;
        
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        
        // Получаем координаты корректно для touch и для мыши
        let x, y;
        if (e.clientX) {
            x = e.clientX;
            y = e.clientY;
        } else if (e.touches && e.touches[0]) {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else {
            // Центр экрана если координаты не определены
            x = window.innerWidth / 2;
            y = window.innerHeight / 2;
        }
        
        n.style.left = (x - 15) + "px";
        n.style.top = (y - 20) + "px";
        
        document.body.appendChild(n);
        
        // Удаляем через 800мс после окончания анимации
        setTimeout(() => {
            if (n.parentNode) n.remove();
        }, 800);
    }
};
