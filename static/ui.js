const ui = {
    currentModal: null,

    // 1. Инициализация
    init() {
        this.update();
        if (window.Telegram?.WebApp) {
            const tw = window.Telegram.WebApp;
            tw.expand(); // Развернуть на весь экран
            tw.BackButton.onClick(() => this.closeM());
        }
        console.log("Neural Pulse UI Manager v3.8.0 stable loaded");
    },

    // 2. Обновление цифр на главном экране
    update() {
        if (!window.logic || !logic.user) return;

        const bEl = document.getElementById('balance');
        const eT = document.getElementById('eng-val');
        const eF = document.getElementById('eng-fill');
        const lEl = document.getElementById('u-lvl');
        const pEl = document.getElementById('profit-val');
        const tV = document.getElementById('tap-val');

        // Баланс с пробелами (247 111...)
        if (bEl) bEl.innerText = Math.floor(logic.user.balance || 0).toLocaleString('ru-RU');
        
        // Энергия (текст и полоска)
        if (eT) eT.innerText = `${Math.floor(logic.user.energy || 0)}/${logic.user.max_energy || 1000}`;
        if (eF) {
            const pct = (logic.user.energy / (logic.user.max_energy || 1000) * 100) || 0;
            eF.style.width = pct + '%';
        }
        
        // Уровень, доход и сила клика
        if (lEl) lEl.innerText = `LVL ${logic.user.lvl || 2}`;
        if (pEl) pEl.innerText = Math.floor(logic.user.profit_hr || 0).toLocaleString('ru-RU');
        if (tV) tV.innerText = `+${logic.user.click_lvl || 1}`;
    },

    // 3. Управление модальными окнами
    openM(id) {
        if (this.currentModal) this.closeM();
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.show();
            
            // Вызов отрисовки контента в зависимости от окна
            if (id === 'wallet') this.renderWallet();
            if (id === 'squad') this.renderFriends();
            if (id === 'mine') this.renderShop();
            if (id === 'boost') this.renderBoost();
        }
    },

    closeM() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal = null;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.hide();
        }
    },

    // --- ФУНКЦИИ КОНТЕНТА ИЗ ВЕРСИИ 3.8.0 ---

    // Окно кошелька
    renderWallet() {
        const cont = document.querySelector('#m-wallet .modal-content');
        if (!cont) return;
        cont.innerHTML = `
            <h1 style="color:#00ffff">👛 WALLET</h1>
            <p>Connect your TON wallet for future airdrops</p>
            <div class="stat-card" style="margin:20px 0; border-color:#00ffff">
                <small>STATUS</small>
                <b>NOT CONNECTED</b>
            </div>
            <button class="back-btn" style="background:#00ffff; color:#000; margin-bottom:10px" onclick="ui.alert('Soon...')">CONNECT TON</button>
            <button class="back-btn" onclick="ui.closeM()">BACK</button>
        `;
    },

    // Окно друзей (Рефералы)
    renderFriends() {
        const cont = document.querySelector('#m-squad .modal-content');
        if (!cont) return;
        const refLink = `https://t.me/neural_pulse_bot?start=${logic.user.userId || '0'}`;
        cont.innerHTML = `
            <h1 style="color:#ae00ff">🤝 FRIENDS</h1>
            <p>Invite friends and get 5,000 for each!</p>
            <div class="stat-card" style="margin:20px 0">
                <small>YOUR FRIENDS</small>
                <b>${logic.user.ref_count || 0}</b>
            </div>
            <button class="back-btn" style="background:#ae00ff; color:#fff; margin-bottom:10px" onclick="ui.copy('${refLink}')">COPY LINK</button>
            <button class="back-btn" onclick="ui.closeM()">BACK</button>
        `;
    },

    // Окно магазина (Апгрейды)
    renderShop() {
        const cont = document.querySelector('#m-mine .modal-content');
        if (!cont) return;
        const tapPrice = (logic.user.click_lvl || 1) * 2000;
        cont.innerHTML = `
            <h1>⛏️ MINING</h1>
            <div style="display:grid; gap:15px; margin-top:20px">
                <div class="stat-card" onclick="ui.buy('tap', ${tapPrice})">
                    <small>UPGRADE TAP (Lvl ${logic.user.click_lvl || 1})</small>
                    <b style="color:#00ffff">Price: ${tapPrice.toLocaleString()}</b>
                </div>
                <div class="stat-card">
                    <small>PASSIVE MINING</small>
                    <b>Coming Soon</b>
                </div>
            </div>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:auto">BACK</button>
        `;
    },

    // Вспомогательные функции
    copy(text) {
        navigator.clipboard.writeText(text);
        this.alert("Link copied to clipboard!");
    },

    alert(msg) {
        if (window.Telegram?.WebApp) Telegram.WebApp.showAlert(msg);
        else alert(msg);
    },

    buy(type, price) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            if (type === 'tap') logic.user.click_lvl = (logic.user.click_lvl || 1) + 1;
            
            logic.save(); // Сохраняем в БД
            this.update(); // Обновляем экран
            this.renderShop(); // Обновляем меню магазина
            
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        } else {
            this.alert("Insufficient funds!");
        }
    }
};
