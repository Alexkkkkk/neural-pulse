const ui = {
    init() {
        const tapBtn = document.getElementById('tap-target');
        if (tapBtn) {
            tapBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                logic.tap();
            });
        }
        this.update();
        console.log("🖥️ UI Готов");
    },

    update() {
        if (!logic.user) return;
        const u = logic.user;
        document.getElementById('balance').innerText = Math.floor(u.balance).toLocaleString('ru-RU');
        document.getElementById('tap-val').innerText = `+${u.click_lvl}`;
        document.getElementById('profit-val').innerText = Math.floor(u.profit_hr).toLocaleString('ru-RU');
        document.getElementById('u-lvl').innerText = `LVL ${u.lvl}`;
        document.getElementById('u-name').innerText = u.username || "Agent";
        
        const engPct = (u.energy / u.max_energy) * 100;
        document.getElementById('eng-val').innerText = `${Math.floor(u.energy)}/${u.max_energy}`;
        document.getElementById('eng-fill').style.width = `${engPct}%`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;

        let content = "";
        if (id === 'top') {
            content = `
                <div class="modal-header">GLOBAL TOP</div>
                <div class="upgrade-card" style="border: 1px solid var(--accent)">
                    <b>1. ${logic.user.username} (You)</b>
                    <span>${Math.floor(logic.user.balance).toLocaleString()} 💰</span>
                </div>
                <div class="upgrade-card"><span>2. Neural_Master</span> <span>50 000 💰</span></div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'wallet') {
            const addr = logic.user.wallet ? 
                `${logic.user.wallet.slice(0,6)}...${logic.user.wallet.slice(-4)}` : 
                "Not connected";
            content = `
                <div class="modal-header">WALLET</div>
                <p style="text-align:center;">Status: ${addr}</p>
                <button class="back-btn" onclick="ui.connectWallet()" style="background:var(--accent); color:black;">CONNECT TON</button>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'boost') {
            content = `
                <div class="modal-header">BOOST</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <div><b>Multitap</b><br><small>Level ${logic.user.click_lvl}</small></div>
                    <div class="upg-price">💰 1 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }

        m.querySelector('.modal-content').innerHTML = content;
        m.classList.add('active');
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    async handleBuy(t, c, v) {
        if (await logic.buyUpgrade(t, c, v)) {
            this.openM('boost'); // Обновить окно
        }
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        const x = e?.touches ? e.touches[0].clientX : (e?.clientX || window.innerWidth / 2);
        const y = e?.touches ? e.touches[0].clientY : (e?.clientY || window.innerHeight / 2);
        n.style.left = `${x}px`;
        n.style.top = `${y}px`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
