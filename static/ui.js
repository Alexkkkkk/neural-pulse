const ui = {
    init() {
        console.log("🖥️ [UI] Система готова");
        const firstNav = document.querySelector('.bottom-nav .nav-btn');
        if (firstNav) firstNav.classList.add('active');
        this.update();
    },

    update() {
        if (typeof logic === 'undefined' || !logic.user) return;
        try {
            const user = logic.user;
            document.getElementById('balance').innerText = Math.floor(user.balance).toLocaleString('ru-RU');
            document.getElementById('tap-val').innerText = "+" + user.click_lvl;
            document.getElementById('profit-val').innerText = Math.floor(user.profit_hr).toLocaleString('ru-RU');
            document.getElementById('u-lvl').innerText = `LVL ${user.lvl}`;
            document.getElementById('u-name').innerText = user.username || "Agent";
            
            const currentEng = Math.floor(user.energy);
            const maxEng = user.max_energy;
            document.getElementById('eng-val').innerText = `${currentEng}/${maxEng}`;
            document.getElementById('eng-fill').style.width = (currentEng / maxEng * 100) + "%";
        } catch (e) { console.error("Update Error:", e); }
    },

    openM(id) {
        // Подсветка кнопок
        document.querySelectorAll('.bottom-nav .nav-btn, .side-btn').forEach(btn => btn.classList.remove('active'));
        if (window.event && window.event.currentTarget) {
            window.event.currentTarget.classList.add('active');
        }

        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        let content = "";
        const user = logic.user;

        if (id === 'top') {
            content = `
                <div class="modal-header" style="color:var(--accent); font-size:18px; margin-bottom:20px;">GLOBAL TOP</div>
                <div class="upgrade-card" style="border: 1px solid var(--accent); background: rgba(0, 255, 242, 0.05);">
                    <div class="upg-info"><b>1. ${user.username} (You)</b></div>
                    <div class="upg-price">${Math.floor(user.balance).toLocaleString()} 💰</div>
                </div>
                <div class="upgrade-card" style="opacity:0.7;">
                    <div class="upg-info">2. Neural_Master</div>
                    <div class="upg-price">50 000 💰</div>
                </div>
                <div class="upgrade-card" style="opacity:0.5;">
                    <div class="upg-info">3. Crypto_King</div>
                    <div class="upg-price">12 500 💰</div>
                </div>
            `;
        } else if (id === 'wallet') {
            content = `
                <div class="modal-header">WALLET</div>
                <div style="text-align:center; padding:20px;">
                    <div style="font-size:50px; margin-bottom:15px;">👛</div>
                    <p style="font-size:14px; color:#aaa;">Подключите TON кошелек для вывода Neural Pulse</p>
                    <button class="back-btn" style="background:var(--accent); color:#000; width:100%; margin-top:20px; font-weight:bold;">CONNECT TON</button>
                </div>
            `;
        } else if (id === 'boost') {
            content = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <div class="upg-info"><b>Multitap</b><br><small>Level ${user.click_lvl}</small></div>
                    <div class="upg-price">1 000 💰</div>
                </div>
            `;
        } else {
            content = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; padding:20px; color:#666;">Coming Soon...</p>`;
        }

        content += `<button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        m.querySelector('.modal-content').innerHTML = content;
        m.classList.add('active');
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    async handleBuy(type, cost, val) {
        if (await logic.buyUpgrade(type, cost, val)) {
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            this.openM('boost');
        } else {
            alert("Недостаточно Neural Pulse!");
        }
    }
};
