// Инициализация TON UI
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
});

const ui = {
    update() {
        if (typeof logic === 'undefined' || !logic.user) return;

        const balEl = document.getElementById('balance');
        if (balEl) balEl.innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');

        const engVal = document.getElementById('eng-val');
        const engFill = document.getElementById('eng-fill');
        if (engVal) engVal.innerText = `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`;
        if (engFill) engFill.style.width = (logic.user.energy / logic.user.max_energy * 100) + "%";

        const tapEl = document.getElementById('tap-val');
        if (tapEl) tapEl.innerText = "+" + logic.user.click_lvl;

        const profitEl = document.getElementById('profit-val');
        if (profitEl) profitEl.innerText = Math.floor(logic.user.profit_hr).toLocaleString('ru-RU');
        
        const lvlEl = document.getElementById('u-lvl');
        if (lvlEl) lvlEl.innerText = `LVL ${logic.user.lvl}`;
    },

    async openM(id) {
        const modal = document.getElementById('m-' + id);
        if (!modal) return;
        const inner = modal.querySelector('.modal-content');
        if (!inner) return;

        modal.classList.add('active');

        if (id === 'wallet') {
            inner.innerHTML = `
                <div class="modal-header">CRYPTO WALLET</div>
                <div style="text-align:center; padding: 20px;">
                    <div id="ton-connect-btn" style="display:flex; justify-content:center; margin-bottom:20px;"></div>
                    <p id="wallet-status" style="font-size:12px; color:#888; word-break:break-all;">
                        ${logic.user.wallet ? `Connected: ${logic.user.wallet}` : 'Connect your TON wallet to save progress'}
                    </p>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;

            // Привязываем кнопку TON Connect к контейнеру
            tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };

            // Следим за подключением
            tonConnectUI.onStatusChange(async (wallet) => {
                if (wallet && wallet.account.address !== logic.user.wallet) {
                    const addr = wallet.account.address;
                    logic.user.wallet = addr;
                    document.getElementById('wallet-status').innerText = "Connected: " + addr;
                    
                    await fetch('/api/wallet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: logic.user.user_id, address: addr })
                    });
                }
            });

        } else if (id === 'top') {
            inner.innerHTML = `<div class="modal-header">LEADERBOARD</div><div style="text-align:center;padding:20px;">Loading...</div>`;
            try {
                const res = await fetch('/api/top');
                const players = await res.json();
                let html = `<div class="modal-header">TOP 100 PLAYERS</div><div class="top-list" style="max-height:60vh; overflow-y:auto; margin: 10px 0;">`;
                players.forEach((p, i) => {
                    const isMe = p.username === logic.user.username ? 'style="border: 1px solid var(--accent); background: rgba(0,255,255,0.05);"' : '';
                    html += `
                        <div class="upgrade-card" ${isMe} style="margin-bottom:8px; padding:10px 15px;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="color:var(--accent); font-weight:bold; width:25px;">#${i+1}</span>
                                <div><b>${p.username}</b><br><small style="color:#666;">LVL ${p.lvl}</small></div>
                            </div>
                            <div style="font-weight:bold; color:#fff;">💰 ${Math.floor(p.balance).toLocaleString()}</div>
                        </div>`;
                });
                html += `</div><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
                inner.innerHTML = html;
            } catch (e) { inner.innerHTML = `<div class="modal-header">ERROR</div><button class="back-btn" onclick="ui.closeM()">BACK</button>`; }
        } else if (id === 'boost') {
            inner.innerHTML = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <div class="upg-info"><b>MULTITAP (LVL ${logic.user.click_lvl})</b><small>+1 к клику</small></div>
                    <div class="upg-price">💰 1 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else if (id === 'mine') {
            inner.innerHTML = `
                <div class="modal-header">MINING</div>
                <div class="upgrade-card" onclick="ui.handleBuy('profit', 5000, 100)">
                    <div class="upg-info"><b>NEURAL CORE</b><small>+100/час</small></div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        } else {
            inner.innerHTML = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; padding:20px; color:#666;">Soon...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }
    },

    closeM() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); },
    
    async handleBuy(type, cost, val) {
        const ok = await logic.buyUpgrade(type, cost, val);
        if (ok) this.openM(type === 'profit' ? 'mine' : 'boost');
        else (window.Telegram?.WebApp ? window.Telegram.WebApp.showAlert("No money!") : alert("No money!"));
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        let x = e.clientX || (e.touches ? e.touches[0].clientX : window.innerWidth / 2);
        let y = e.clientY || (e.touches ? e.touches[0].clientY : window.innerHeight / 2);
        n.style.left = (x - 15) + "px"; n.style.top = (y - 20) + "px";
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
