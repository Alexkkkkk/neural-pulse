const ui = {
    /**
     * Инициализация UI: слушатели событий и TON Connect
     */
    init() {
        console.log("🎨 UI System Booted");
        const target = document.getElementById('tap-target');
        
        if (target) {
            target.onclick = (e) => logic.tap(e);
        }

        if (window.tonConnectUI) {
            window.tonConnectUI.onStatusChange(async (wallet) => {
                if (wallet && wallet.account.address) {
                    await this.saveWallet(wallet.account.address);
                } else {
                    await this.saveWallet(null);
                }
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
            
            const info = document.getElementById('wallet-info');
            if (info) {
                if (addr) {
                    info.innerHTML = `
                        <p style="color:#00f2ff; font-size:11px; margin: 10px 0;">CONNECTED: ${addr.slice(0,6)}...${addr.slice(-6)}</p>
                        <button class="disconnect-btn" onclick="ui.disconnectWallet()">DISCONNECT</button>`;
                } else {
                    info.innerHTML = `<p style="color:#666; font-size:12px; margin: 10px 0;">Link your TON wallet for future rewards</p>`;
                }
            }
        } catch (e) { console.error("Wallet save error", e); }
    },

    async disconnectWallet() {
        try {
            if (window.tonConnectUI.connected) {
                await window.tonConnectUI.disconnect();
            }
            await this.saveWallet(null);
        } catch (e) { console.error("Disconnect error", e); }
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
        set('profit-val', Math.floor(u.profit_hr || 0).toLocaleString());
        set('tap-val', `+${u.click_lvl}`);
        
        const fill = document.getElementById('eng-fill');
        if (fill) {
            const perc = (u.energy / u.max_energy) * 100;
            fill.style.width = `${perc}%`;
        }
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
                <div class="wallet-box">
                    <img src="logo.png" class="mini-icon-main">
                    <div id="ton-connect-btn"></div>
                    <div id="wallet-info">
                        ${addr ? 
                            `<p style="color:#00f2ff; font-size:11px; margin: 10px 0;">CONNECTED: ${addr.slice(0,6)}...${addr.slice(-6)}</p>
                             <button class="disconnect-btn" onclick="ui.disconnectWallet()">DISCONNECT</button>` : 
                            `<p style="color:#666; font-size:12px; margin: 10px 0;">Link your TON wallet for future rewards</p>`
                        }
                    </div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            setTimeout(() => {
                if (window.tonConnectUI) {
                    window.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
                }
            }, 100);

        } else if (id === 'boost') {
            container.innerHTML = `
                <div class="modal-header">🚀 BOOSTERS</div>
                <div class="upgrade-list">
                    <div class="upg-item" onclick="logic.upgrade('tap')">
                        <div class="upg-left">
                            <div class="upg-icon">👆</div>
                            <div>
                                <b>MULTITAP</b><br>
                                <small>Cost: ${(logic.user.click_lvl * 1000).toLocaleString()}</small>
                            </div>
                        </div>
                        <div class="upg-lvl">LVL ${logic.user.click_lvl}</div>
                    </div>
                    <div class="upg-item" onclick="logic.upgrade('energy')">
                        <div class="upg-left">
                            <div class="upg-icon">🔋</div>
                            <div>
                                <b>ENERGY LIMIT</b><br>
                                <small>Cost: ${(logic.user.lvl * 500).toLocaleString()}</small>
                            </div>
                        </div>
                        <div class="upg-lvl">LVL ${logic.user.lvl}</div>
                    </div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'mine') {
            container.innerHTML = `
                <div class="modal-header">⛏️ MINING</div>
                <div class="upgrade-list">
                    <div class="upg-item disabled">
                        <div class="upg-left">
                            <div class="upg-icon">⚙️</div>
                            <div>
                                <b>NEURAL CORE</b><br>
                                <small>Coming soon...</small>
                            </div>
                        </div>
                    </div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'top') {
            container.innerHTML = `
                <div class="modal-header">🏆 TOP AGENTS</div>
                <div id="top-list" class="top-list-container">Loading leaderboard...</div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            this.loadTop();
        } else if (id === 'squad') {
            const link = `https://t.me/n_pulse_bot?start=${logic.user.user_id}`;
            container.innerHTML = `
                <div class="modal-header">🤝 SQUAD</div>
                <div class="squad-box">
                    <div class="squad-icon">💎</div>
                    <p>Invite friends and get <span class="accent-val">10,000 Pulse</span></p>
                    <div class="ref-link-box">${link}</div>
                    <button class="copy-btn" onclick="ui.copyLink('${link}')">COPY INVITE LINK</button>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            container.innerHTML = `<div class="modal-header">${id.toUpperCase()}</div><p style="padding:40px; text-align:center; opacity:0.5;">Coming soon...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }
    },

    loadTop() {
        const list = document.getElementById('top-list');
        if (!list) return;
        fetch('/api/top').then(res => res.json()).then(data => {
            list.innerHTML = data.map((p, i) => `
                <div class="top-item">
                    <div class="top-left">
                        <span class="rank">${i+1}</span>
                        <span class="name">${p.username || 'Agent'}</span>
                    </div>
                    <b class="val">${Math.floor(p.balance).toLocaleString()}</b>
                </div>
            `).join('');
        }).catch(() => { list.innerHTML = "Error loading top"; });
    },

    copyLink(text) {
        navigator.clipboard.writeText(text);
        const btn = document.querySelector('.copy-btn');
        btn.innerText = 'COPIED!';
        setTimeout(() => btn.innerText = 'COPY INVITE LINK', 2000);
    },

    closeM() { 
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); 
    }
};
