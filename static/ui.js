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

        // Слушатель изменения статуса кошелька
        if (window.tonConnectUI) {
            window.tonConnectUI.onStatusChange(async (wallet) => {
                if (wallet && wallet.account.address) {
                    await this.saveWallet(wallet.account.address);
                } else {
                    // Если кошелек отвязан в самом приложении Tonkeeper
                    await this.saveWallet(null);
                }
            });
        }
        this.update();
    },

    /**
     * Сохранение или удаление адреса кошелька в БД
     */
    async saveWallet(addr) {
        if (!logic.user) return;
        try {
            await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: logic.user.user_id, address: addr })
            });
            logic.user.wallet = addr;
            console.log(addr ? "👛 Wallet Saved" : "Empty Wallet Saved");
            
            // Если мы в окне кошелька, перерисовываем его статус
            const info = document.getElementById('wallet-info');
            if (info) {
                if (addr) {
                    info.innerHTML = `<p style="color:#00f2ff; font-size:11px;">CONNECTED: ${addr.slice(0,6)}...${addr.slice(-6)}</p>
                    <button onclick="ui.disconnectWallet()" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:10px; text-decoration:underline; margin-top:5px;">DISCONNECT</button>`;
                } else {
                    info.innerHTML = `<p style="color:#666; font-size:12px;">Link your TON wallet for future rewards</p>`;
                }
            }
        } catch (e) { 
            console.error("Wallet save error", e); 
        }
    },

    /**
     * Принудительное отключение кошелька
     */
    async disconnectWallet() {
        try {
            if (window.tonConnectUI.connected) {
                await window.tonConnectUI.disconnect();
            }
            await this.saveWallet(null);
        } catch (e) {
            console.error("Disconnect error", e);
        }
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
                <div style="padding:30px 10px; text-align:center;">
                    <div id="ton-connect-btn" style="display:flex; justify-content:center; margin-bottom:15px;"></div>
                    <div id="wallet-info">
                        ${addr ? 
                            `<p style="color:#00f2ff; font-size:11px;">CONNECTED: ${addr.slice(0,6)}...${addr.slice(-6)}</p>
                             <button onclick="ui.disconnectWallet()" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:10px; text-decoration:underline; margin-top:5px;">DISCONNECT</button>` : 
                            `<p style="color:#666; font-size:12px;">Link your TON wallet for future rewards</p>`
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
                <div class="modal-header">BOOST</div>
                <div style="padding:15px;">
                    <div class="upgrade-card" style="margin-bottom:10px; border:1px solid #333; background:#111; padding:15px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;" onclick="logic.upgrade('tap')">
                        <div>
                            <b>MULTITAP</b><br>
                            <small id="b-tap-cost">Cost: ${logic.user.click_lvl * 1000}</small>
                        </div>
                        <b style="color:#00f2ff;">LVL ${logic.user.click_lvl}</b>
                    </div>
                    <div class="upgrade-card" style="border:1px solid #333; background:#111; padding:15px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;" onclick="logic.upgrade('energy')">
                        <div>
                            <b>ENERGY LIMIT</b><br>
                            <small id="b-eng-cost">Cost: ${logic.user.lvl * 500}</small>
                        </div>
                        <b style="color:#00f2ff;">LVL ${logic.user.lvl}</b>
                    </div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'top') {
            container.innerHTML = `
                <div class="modal-header">TOP AGENTS</div>
                <div id="top-list" style="max-height:400px; overflow-y:auto; padding:0 10px;">Loading leaderboard...</div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            this.loadTop();
        } else if (id === 'squad') {
            const link = `https://t.me/n_pulse_bot?start=${logic.user.user_id}`;
            container.innerHTML = `
                <div class="modal-header">SQUAD</div>
                <div style="padding:20px; text-align:center;">
                    <p style="font-size:14px; margin-bottom:20px;">Invite friends and get <span style="color:#00f2ff;">10,000 Pulse</span></p>
                    <div style="background:#000; border:1px dashed #333; padding:15px; border-radius:10px; margin-bottom:20px; font-size:11px; color:#00f2ff; word-break: break-all;">${link}</div>
                    <button class="back-btn" style="background: linear-gradient(90deg, #00f2ff, #ae00ff); color:#000; border:none; width:100%" onclick="ui.copyLink('${link}')">COPY INVITE LINK</button>
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
                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #151515;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="color:#666; width:20px;">${i+1}</span>
                        <span>${p.username || 'Agent'}</span>
                    </div>
                    <b style="color:#00f2ff;">${Math.floor(p.balance).toLocaleString()}</b>
                </div>
            `).join('');
        }).catch(() => { list.innerHTML = "Error loading top"; });
    },

    copyLink(text) {
        navigator.clipboard.writeText(text);
        alert('Copied!');
    },

    closeM() { 
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); 
    }
};
