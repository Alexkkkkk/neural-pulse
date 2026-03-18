const ui = {
    currentModal: null,

    init() {
        this.update();
        if (window.Telegram?.WebApp) {
            const tw = window.Telegram.WebApp;
            tw.expand();
            tw.BackButton.onClick(() => this.closeM());
        }
        console.log("Neural Pulse UI Manager v3.8.0 Stable Restored");
    },

    // Обновление главных цифр на главном экране
    update() {
        if (!window.logic || !logic.user) return;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setTxt('balance', Math.floor(logic.user.balance || 0).toLocaleString('ru-RU'));
        setTxt('u-lvl', `LVL ${logic.user.lvl || 1}`);
        setTxt('profit-val', Math.floor(logic.user.profit_hr || 0).toLocaleString('ru-RU'));
        setTxt('tap-val', `+${logic.user.click_lvl || 1}`);
        setTxt('eng-val', `${Math.floor(logic.user.energy || 0)}/${logic.user.max_energy || 1000}`);

        const fill = document.getElementById('eng-fill');
        if (fill) {
            const pct = (logic.user.energy / (logic.user.max_energy || 1000) * 100) || 0;
            fill.style.width = pct + '%';
        }
    },

    // Открытие модальных окон
    openM(id) {
        if (this.currentModal) this.closeM();
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.show();
            
            // Вызываем отрисовку контента в зависимости от ID
            if (id === 'wallet') this.renderWallet();
            if (id === 'top') this.renderTop();
            if (id === 'boost') this.renderBoost();
            if (id === 'mine') this.renderMine();
            if (id === 'squad') this.renderFriends();
            if (id === 'tasks') this.renderTasks();
            if (id === 'bonus') this.renderBonus();
        }
    },

    closeM() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal = null;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.hide();
        }
    },

    // --- РЕНДЕРИНГ КОНТЕНТА (v3.8.0) ---

    renderWallet() {
        const cont = document.querySelector('#m-wallet .modal-content');
        if (!cont) return;
        cont.innerHTML = `
            <h1 style="color:#00ffff">👛 WALLET</h1>
            <p>Connect TON wallet for airdrops</p>
            <div class="stat-card" style="margin:20px 0; border: 1px solid #00ffff55">
                <small>STATUS</small>
                <b style="color:#ff4444">NOT CONNECTED</b>
            </div>
            <button class="back-btn" style="background:#00ffff; color:#000; margin-bottom:10px" onclick="ui.alert('Wallet connection coming soon!')">CONNECT TON</button>
            <button class="back-btn" onclick="ui.closeM()">BACK</button>
        `;
    },

    renderTop() {
        const cont = document.querySelector('#m-top .modal-content');
        if (!cont) return;
        cont.innerHTML = `
            <h1 style="color:#ffcc00">🏆 TOP AGENTS</h1>
            <div style="width:100%; margin:20px 0; display:flex; flex-direction:column; gap:10px">
                <div class="stat-card" style="display:flex; justify-content:space-between"><span>1. Quantum_X</span><b>99.5M</b></div>
                <div class="stat-card" style="display:flex; justify-content:space-between; border-color:#00ffff">
                    <span>2. ${logic.user.username || 'You'}</span><b>${Math.floor(logic.user.balance).toLocaleString()}</b>
                </div>
                <div class="stat-card" style="display:flex; justify-content:space-between"><span>3. Cyber_Punk</span><b>1.2M</b></div>
            </div>
            <button class="back-btn" onclick="ui.closeM()">BACK</button>
        `;
    },

    renderBoost() {
        const cont = document.querySelector('#m-boost .modal-content');
        if (!cont) return;
        const tapPrice = (logic.user.click_lvl || 1) * 1000;
        const energyPrice = (logic.user.max_energy / 500) * 1500;

        cont.innerHTML = `
            <h1 style="color:#ff4444">🚀 BOOSTERS</h1>
            <div class="stat-card" onclick="ui.buy('tap', ${tapPrice})" style="margin-bottom:10px">
                <small>MULTITAP (Lvl ${logic.user.click_lvl})</small>
                <b style="color:#00ffff">Price: ${tapPrice.toLocaleString()}</b>
            </div>
            <div class="stat-card" onclick="ui.buy('energy', ${energyPrice})">
                <small>ENERGY CAP</small>
                <b style="color:#00ffff">Price: ${energyPrice.toLocaleString()}</b>
            </div>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:20px">BACK</button>
        `;
    },

    renderMine() {
        const cont = document.querySelector('#m-mine .modal-content');
        if (!cont) return;
        cont.innerHTML = `
            <h1 style="color:#ae00ff">⛏️ MINING</h1>
            <div class="stat-card" onclick="ui.buy('profit', 5000)">
                <small>NEURAL PROCESSOR</small>
                <b>Price: 5,000 (+100/hr)</b>
            </div>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:20px">BACK</button>
        `;
    },

    renderFriends() {
        const cont = document.querySelector('#m-squad .modal-content');
        if (!cont) return;
        const link = `https://t.me/neural_pulse_bot?start=${logic.user.userId || '123'}`;
        cont.innerHTML = `
            <h1>🤝 FRIENDS</h1>
            <div class="stat-card" style="margin:20px 0">
                <small>YOUR INVITE LINK</small>
                <div style="font-size:11px; color:#00ffff; margin:10px 0; word-break:break-all">${link}</div>
            </div>
            <button class="back-btn" style="background:#fff; color:#000" onclick="ui.copy('${link}')">COPY LINK</button>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:10px">BACK</button>
        `;
    },

    renderBonus() {
        const cont = document.querySelector('#m-bonus .modal-content');
        if (!cont) return;
        cont.innerHTML = `
            <h1>🎁 DAILY BONUS</h1>
            <p>Come back every 24h</p>
            <button class="back-btn" style="background:#ffcc00; color:#000" onclick="ui.alert('Already claimed today!')">CLAIM 5,000</button>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:10px">BACK</button>
        `;
    },

    renderTasks() {
        const cont = document.querySelector('#m-tasks .modal-content');
        if (!cont) return;
        cont.innerHTML = `
            <h1>📋 TASKS</h1>
            <div class="stat-card" onclick="ui.alert('Task starting...')">
                <small>SOCIAL</small><b>Subscribe Channel (+10k)</b>
            </div>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:20px">BACK</button>
        `;
    },

    // --- СИСТЕМНЫЕ ФУНКЦИИ ---

    alert(msg) {
        if (window.Telegram?.WebApp) Telegram.WebApp.showAlert(msg);
        else alert(msg);
    },

    copy(txt) {
        navigator.clipboard.writeText(txt).then(() => this.alert("Copied!"));
    },

    buy(type, price) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            if (type === 'tap') logic.user.click_lvl += 1;
            if (type === 'energy') logic.user.max_energy += 500;
            if (type === 'profit') logic.user.profit_hr += 100;
            
            logic.save();
            this.update();
            
            // Перерисовка окна после покупки
            if (type === 'tap' || type === 'energy') this.renderBoost();
            if (type === 'profit') this.renderMine();
            
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        } else {
            this.alert("Insufficient balance!");
        }
    }
};
