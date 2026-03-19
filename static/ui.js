const ui = {
    init() {
        console.log("🎨 UI System Booted");
        const target = document.getElementById('tap-target');
        if (target) target.onclick = (e) => logic.tap(e);

        // Следим за подключением кошелька
        if (window.tonConnectUI) {
            window.tonConnectUI.onStatusChange(async (wallet) => {
                if (wallet && wallet.account.address) {
                    await this.saveWallet(wallet.account.address);
                }
            });
        }
        this.update();
    },

    async saveWallet(addr) {
        try {
            await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: logic.user.user_id, address: addr })
            });
            logic.user.wallet = addr;
            console.log("👛 Wallet Saved to DB");
        } catch (e) { console.error("Wallet save error", e); }
    },

    update() {
        if (!logic.user) return;
        const u = logic.user;
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };
        set('balance', Math.floor(u.balance).toLocaleString('ru-RU'));
        set('u-lvl', `LVL ${u.lvl}`);
        set('eng-val', `${Math.floor(u.energy)}/${u.max_energy}`);
        set('profit-val', u.profit_hr || 0);
        set('tap-val', `+${u.click_lvl}`);
        
        const fill = document.getElementById('eng-fill');
        if (fill) fill.style.width = `${(u.energy / u.max_energy) * 100}%`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;
        m.classList.add('active');
        const container = m.querySelector('.modal-content');

        if (id === 'wallet') {
            const addr = logic.user.wallet;
            container.innerHTML = `
                <div class="modal-header">TON WALLET</div>
                <div style="padding:30px 10px; text-align:center;">
                    <div id="ton-connect-btn" style="display:flex; justify-content:center; margin-bottom:15px;"></div>
                    
                    <div id="wallet-info">
                        ${addr ? 
                            `<p style="color:#00f2ff; font-size:11px;">CONNECTED: ${addr.slice(0,6)}...${addr.slice(-6)}</p>` : 
                            `<p style="color:#666; font-size:12px;">Link your TON wallet for future rewards</p>`
                        }
                    </div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            
            // Принудительно заставляем TON Connect отрисовать кнопку в только что созданном div
            setTimeout(() => {
                if (window.tonConnectUI) {
                    window.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
                }
            }, 100);

        } else if (id === 'top') {
            container.innerHTML = `<div class="modal-header">TOP AGENTS</div><div id="top-list" style="max-height:300px; overflow-y:auto;">Loading...</div><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
            this.loadTop();
        } else if (id === 'squad') {
            const link = `https://t.me/neural_pulse_bot?start=${logic.user.user_id}`;
            container.innerHTML = `
                <div class="modal-header">SQUAD</div>
                <div style="padding:20px; text-align:center;">
                    <p style="font-size:14px;">Invite friends and get 10,000</p>
                    <div style="background:#111; padding:10px; border-radius:5px; margin:15px 0; font-size:10px; color:#00f2ff;">${link}</div>
                    <button class="back-btn" style="background:#00f2ff; color:#000; width:100%" onclick="navigator.clipboard.writeText('${link}'); alert('Copied!')">COPY LINK</button>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            container.innerHTML = `<div class="modal-header">${id.toUpperCase()}</div><p style="padding:20px; text-align:center; color:#555;">Module under construction...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }
    },

    async loadTop() {
        const list = document.getElementById('top-list');
        try {
            const res = await fetch('/api/top');
            const data = await res.json();
            list.innerHTML = data.map((p, i) => `
                <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #222;">
                    <span>${i+1}. ${p.name || 'Agent'}</span>
                    <b style="color:#00f2ff;">${Math.floor(p.balance).toLocaleString()}</b>
                </div>
            `).join('');
        } catch (e) { list.innerHTML = "Error loading"; }
    },

    closeM() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
};
