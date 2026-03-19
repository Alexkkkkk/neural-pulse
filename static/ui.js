const ui = {
    init() {
        const target = document.getElementById('tap-target');
        if (target) target.onclick = (e) => logic.tap(e);

        if (window.tonConnectUI) {
            window.tonConnectUI.onStatusChange(async (wallet) => {
                const addr = wallet ? wallet.account.address : null;
                await this.saveWallet(addr);
            });
        }
        this.update();
    },

    async saveWallet(addr) {
        if (!logic.user) return;
        try {
            await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: logic.user.user_id, address: addr })
            });
            logic.user.wallet = addr;
            this.renderWalletUI(addr);
        } catch (e) { console.error("Wallet save error", e); }
    },

    renderWalletUI(addr) {
        const info = document.getElementById('wallet-info');
        if (!info) return;
        info.innerHTML = addr ? 
            `<p style="color:#00f2ff; font-size:11px; margin: 10px 0;">CONNECTED: ${addr.slice(0,6)}...${addr.slice(-6)}</p>
             <button class="disconnect-btn" onclick="ui.disconnectWallet()">DISCONNECT</button>` : 
            `<p style="color:#666; font-size:12px; margin: 10px 0;">Link your TON wallet for future rewards</p>`;
    },

    async disconnectWallet() {
        if (window.tonConnectUI.connected) await window.tonConnectUI.disconnect();
        await this.saveWallet(null);
    },

    update() {
        if (!logic.user) return;
        const u = logic.user;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        set('balance', Math.floor(u.balance).toLocaleString('ru-RU'));
        set('u-lvl', `LVL ${u.lvl}`);
        set('eng-val', `${Math.floor(u.energy)}/${u.max_energy}`);
        set('profit-val', Math.floor(u.profit_hr || 0).toLocaleString());
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
            container.innerHTML = `
                <div class="modal-header">TON WALLET</div>
                <div class="wallet-box">
                    <img src="logo.png" class="mini-icon-main">
                    <div id="ton-connect-btn" style="display:flex; justify-content:center;"></div>
                    <div id="wallet-info"></div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
            this.renderWalletUI(logic.user.wallet);
            setTimeout(() => {
                window.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }, 100);
        } else if (id === 'top') {
            container.innerHTML = `
                <div class="modal-header">🏆 TOP AGENTS</div>
                <div id="top-list" class="top-list-container">Loading...</div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
            this.loadTop();
        } else if (id === 'boost') {
            container.innerHTML = `
                <div class="modal-header">🚀 BOOSTERS</div>
                <div class="upgrade-list">
                    <div class="upg-item" onclick="logic.upgrade('tap')">
                        <div class="upg-left"><div class="upg-icon">👆</div>
                        <div><b>MULTITAP</b><br><small>Cost: ${logic.user.click_lvl * 1000}</small></div></div>
                        <div class="upg-lvl">LVL ${logic.user.click_lvl}</div>
                    </div>
                    <div class="upg-item" onclick="logic.upgrade('energy')">
                        <div class="upg-left"><div class="upg-icon">🔋</div>
                        <div><b>ENERGY LIMIT</b><br><small>Cost: ${logic.user.lvl * 500}</small></div></div>
                        <div class="upg-lvl">LVL ${logic.user.lvl}</div>
                    </div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else {
             container.innerHTML = `<div class="modal-header">${id.toUpperCase()}</div><p style="padding:40px; text-align:center; opacity:0.5;">Coming soon...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }
    },

    loadTop() {
        const list = document.getElementById('top-list');
        fetch('/api/top').then(res => res.json()).then(data => {
            list.innerHTML = data.map((p, i) => `
                <div class="top-item">
                    <div class="top-left">
                        <span class="rank">${i+1}</span>
                        <span class="name">${p.username || 'Agent'}</span>
                    </div>
                    <b class="val">${Math.floor(p.balance).toLocaleString()}</b>
                </div>`).join('');
        }).catch(() => list.innerHTML = "Error loading top");
    },

    closeM() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
};
