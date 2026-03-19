const ui = {
    init() {
        console.log("🎨 UI: Online");
        const target = document.getElementById('tap-target');
        if (target) {
            target.onclick = (e) => logic.tap(e);
        }

        // Слушаем статус кошелька
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
            console.log("👛 Wallet saved");
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
                <div style="padding:30px 20px; text-align:center;">
                    <div id="ton-connect-btn" style="display:flex; justify-content:center; min-height:44px;"></div>
                    
                    <div style="margin-top:20px;">
                        ${addr ? 
                            `<p style="color:#00f2ff; font-size:12px;">Связан: ${addr.slice(0,6)}...${addr.slice(-6)}</p>` : 
                            `<p style="color:#888; font-size:12px;">Подключите кошелек для участия в Airdrop</p>`
                        }
                    </div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;

            // Важно: перепривязываем кнопку TON Connect после создания HTML
            setTimeout(() => {
                if (window.tonConnectUI) {
                    window.tonConnectUI.uiOptions = { 
                        buttonRootId: 'ton-connect-btn' 
                    };
                    console.log("🔹 TON Button injected");
                } else {
                    console.error("❌ TON Connect SDK not found!");
                }
            }, 100);
        } 
        else if (id === 'top') {
            container.innerHTML = `<div class="modal-header">LEADERBOARD</div><div id="top-list-container" style="max-height:350px; overflow-y:auto;">Loading...</div><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
            this.loadTop();
        }
        else if (id === 'squad') {
            const link = `https://t.me/neural_pulse_bot?start=${logic.user.user_id}`;
            container.innerHTML = `
                <div class="modal-header">SQUAD</div>
                <div style="padding:20px; text-align:center;">
                    <p>+10,000 монет за друга</p>
                    <input type="text" value="${link}" readonly style="width:100%; background:#111; color:#fff; padding:12px; margin:15px 0; border:1px solid #333; border-radius:8px; font-size:10px;">
                    <button class="back-btn" style="background:#00f2ff; color:#000; width:100%; font-weight:bold;" onclick="navigator.clipboard.writeText('${link}'); alert('Copied!')">COPY LINK</button>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
    },

    async loadTop() {
        const topContainer = document.getElementById('top-list-container');
        try {
            const res = await fetch('/api/top');
            const data = await res.json();
            topContainer.innerHTML = data.map((p, i) => `
                <div style="display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid #222; align-items:center;">
                    <span><span style="opacity:0.5; margin-right:5px;">${i+1}</span> ${p.name}</span>
                    <b style="color:#00f2ff;">${Math.floor(p.balance).toLocaleString()}</b>
                </div>
            `).join('');
        } catch (e) { topContainer.innerHTML = "<p>Error loading top</p>"; }
    },

    closeM() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
};
