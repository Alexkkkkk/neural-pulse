const ui = {
    init() {
        console.log("🎨 UI: Online");
        const target = document.getElementById('tap-target');
        if (target) {
            target.onclick = (e) => logic.tap(e);
        }

        // Авто-сохранение кошелька при подключении
        if (logic.tonConnectUI) {
            logic.tonConnectUI.onStatusChange(async (wallet) => {
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
            logic.user.wallet = addr; // Обновляем локально
            console.log("👛 Wallet linked successfully");
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
            const hasWallet = logic.user.wallet;
            container.innerHTML = `
                <div class="modal-header">TON WALLET</div>
                <div style="padding:20px; text-align:center;">
                    <div id="ton-connect-btn" style="display:flex; justify-content:center;"></div>
                    <p style="color:#888; margin-top:15px; font-size:12px;">
                        ${hasWallet ? `Linked: ${hasWallet.slice(0,4)}...${hasWallet.slice(-4)}` : 'Connect for Airdrop'}
                    </p>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            setTimeout(() => {
                if (logic.tonConnectUI) logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }, 50);
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
                    <p>Get 10,000 for each friend!</p>
                    <input type="text" value="${link}" readonly style="width:100%; background:#111; color:#fff; padding:10px; margin:10px 0; border:1px solid #333; border-radius:5px;">
                    <button class="back-btn" style="background:#00f2ff; color:#000; width:100%" onclick="navigator.clipboard.writeText('${link}')">COPY LINK</button>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
        else if (id === 'boost') {
            container.innerHTML = `
                <div class="modal-header">BOOSTERS</div>
                <div style="padding:20px;">
                    <div class="boost-item" onclick="logic.upgrade('tap')" style="display:flex; justify-content:space-between; padding:15px; background:#111; margin-bottom:10px; border-radius:10px;">
                        <span>Multitap (Lvl ${logic.user.click_lvl})</span>
                        <b style="color:#00f2ff;">${(logic.user.click_lvl * 1000).toLocaleString()}</b>
                    </div>
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
                <div class="top-item" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #222;">
                    <span>${i+1}. <img src="${p.photo_url}" style="width:20px; border-radius:50%; vertical-align:middle;"> ${p.name}</span>
                    <b style="color:#00f2ff;">${Math.floor(p.balance).toLocaleString()}</b>
                </div>
            `).join('');
        } catch (e) { topContainer.innerHTML = "<p>Error loading top</p>"; }
    },

    closeM() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        n.style.left = `${e.clientX}px`; n.style.top = `${e.clientY}px`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
