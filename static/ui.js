const ui = {
    currentModal: null,

    init() {
        this.update();
        if (window.Telegram?.WebApp) {
            const tw = window.Telegram.WebApp;
            tw.expand();
            tw.BackButton.onClick(() => this.closeM());
        }
        console.log("Neural Pulse UI Manager v3.8.0 stable restored");
    },

    update() {
        if (!window.logic || !logic.user) return;

        const ids = {
            balance: 'balance',
            energyText: 'eng-val',
            energyFill: 'eng-fill',
            level: 'u-lvl',
            profit: 'profit-val',
            tap: 'tap-val'
        };

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setTxt(ids.balance, Math.floor(logic.user.balance || 0).toLocaleString('ru-RU'));
        setTxt(ids.level, `LVL ${logic.user.lvl || 1}`);
        setTxt(ids.profit, Math.floor(logic.user.profit_hr || 0).toLocaleString('ru-RU'));
        setTxt(ids.tap, `+${logic.user.click_lvl || 1}`);
        setTxt(ids.energyText, `${Math.floor(logic.user.energy || 0)}/${logic.user.max_energy || 1000}`);

        const fill = document.getElementById(ids.energyFill);
        if (fill) {
            const pct = (logic.user.energy / (logic.user.max_energy || 1000) * 100) || 0;
            fill.style.width = pct + '%';
        }
    },

    openM(id) {
        if (this.currentModal) this.closeM();
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.show();
            
            // Вызов функций отрисовки для каждого окна
            switch(id) {
                case 'wallet': this.renderWallet(); break;
                case 'top': this.renderTop(); break;
                case 'boost': this.renderBoost(); break;
                case 'mine': this.renderMine(); break;
                case 'squad': this.renderFriends(); break;
                case 'tasks': this.renderTasks(); break;
            }
        }
    },

    closeM() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal = null;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.hide();
        }
    },

    // --- ФУНКЦИИ КОНТЕНТА ---

    renderWallet() {
        const cont = document.querySelector('#m-wallet .modal-content');
        if (!cont) return;
        cont.innerHTML = `
            <h1 style="color:#00ffff">👛 WALLET</h1>
            <p>Connect your TON wallet for future airdrops</p>
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
            <div style="width:100%; margin:20px 0; display:flex; flex-direction:column; gap:8px">
                <div class="stat-card" style="display:flex; justify-content:space-between">
                    <span>1. Quantum_King</span><b>54.2M</b>
                </div>
                <div class="stat-card" style="display:flex; justify-content:space-between; border-color:#00ffff">
                    <span>2. ${logic.user.username || 'You'}</span><b>${Math.floor(logic.user.balance).toLocaleString()}</b>
                </div>
                <div class="stat-card" style="display:flex; justify-content:space-between">
                    <span>3. Neural_Bot</span><b>1.5M</b>
                </div>
            </div>
            <button class="back-btn" onclick="ui.closeM()">BACK</button>
        `;
    },

    renderBoost() {
        const cont = document.querySelector('#m-boost .modal-content');
        if (!cont) return;
        const tapPrice = (logic.user.click_lvl || 1) * 1500;
        const energyPrice = (logic.user.max_energy / 500) * 2000;

        cont.innerHTML = `
            <h1 style="color:#ff4444">🚀 BOOST</h1>
            <div style="display:grid; gap:10px; width:100%; margin-top:20px">
                <div class="stat-card" onclick="ui.buy('tap', ${tapPrice})">
                    <small>MULTITAP (Lvl ${logic.user.click_lvl})</small>
                    <b style="color:#00ffff">Price: ${tapPrice.toLocaleString()}</b>
                </div>
                <div class="stat-card" onclick="ui.buy('energy', ${energyPrice})">
                    <small>ENERGY LIMIT</small>
                    <b style="color:#00ffff">Price: ${energyPrice.toLocaleString()}</b>
                </div>
            </div>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:20px">BACK</button>
        `;
    },

    renderMine() {
        const cont = document.querySelector('#m-mine .modal-content');
        if (!cont) return;
        cont.innerHTML = `
            <h1 style="color:#ae00ff">⛏️ MINE</h1>
            <p>Upgrade your passive mining hardware</p>
            <div class="stat-card" style="margin-top:20px" onclick="ui.buy('profit', 5000)">
                <small>NEURAL CHIP v1</small>
                <b>Price: 5,000 (+100/hr)</b>
            </div>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:auto">BACK</button>
        `;
    },

    renderFriends() {
        const cont = document.querySelector('#m-squad .modal-content');
        if (!cont) return;
        const link = `https://t.me/neural_pulse_bot?start=${logic.user.userId}`;
        cont.innerHTML = `
            <h1>🤝 SQUAD</h1>
            <p>Your team grows your power</p>
            <div class="stat-card" style="margin:20px 0">
                <small>YOUR INVITE LINK</small>
                <code style="font-size:10px; display:block; margin:10px 0; color:#00ffff; word-break: break-all;">${link}</code>
            </div>
            <button class="back-btn" style="background:#fff; color:#000" onclick="ui.copy('${link}')">COPY LINK</button>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:10px">BACK</button>
        `;
    },

    renderTasks() {
        const cont = document.querySelector('#m-tasks .modal-content');
        if (!cont) return;
        cont.innerHTML = `
            <h1>📋 TASKS</h1>
            <p>Complete missions to earn extra</p>
            <div class="stat-card" onclick="ui.alert('Join our channel first!')">
                <small>SOCIAL</small>
                <b>Join Community (+10k)</b>
            </div>
            <button class="back-btn" onclick="ui.closeM()" style="margin-top:auto">BACK</button>
        `;
    },

    // Вспомогательные методы
    alert(msg) {
        if (window.Telegram?.WebApp) Telegram.WebApp.showAlert(msg);
        else alert(msg);
    },

    copy(txt) {
        navigator.clipboard.writeText(txt).then(() => {
            this.alert("Link copied!");
        });
    },

    buy(type, price) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            if (type === 'tap') logic.user.click_lvl += 1;
            if (type === 'energy') logic.user.max_energy += 500;
            if (type === 'profit') logic.user.profit_hr += 100;
            
            logic.save();
            this.update();
            
            // Сразу обновляем текущее окно
            if (type === 'tap' || type === 'energy') this.renderBoost();
            if (type === 'profit') this.renderMine();
            
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
        } else {
            this.alert("Not enough balance!");
        }
    }
};
