const ui = {
    init() {
        const target = document.getElementById('tap-target');
        if (target) {
            target.addEventListener('pointerdown', (e) => {
                logic.tap();
            });
        }
        this.update();
    },

    update() {
        if (!logic.user) return;
        const u = logic.user;
        document.getElementById('balance').innerText = Math.floor(u.balance).toLocaleString('ru-RU');
        document.getElementById('tap-val').innerText = `+${u.click_lvl}`;
        document.getElementById('profit-val').innerText = Math.floor(u.profit_hr).toLocaleString('ru-RU');
        document.getElementById('u-lvl').innerText = `LVL ${u.lvl}`;
        document.getElementById('u-name').innerText = u.username;
        
        const engPct = (u.energy / u.max_energy) * 100;
        document.getElementById('eng-val').innerText = `${Math.floor(u.energy)}/${u.max_energy}`;
        document.getElementById('eng-fill').style.width = `${engPct}%`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;

        let content = "";
        const u = logic.user;

        if (id === 'wallet') {
            const isConnected = u.wallet && u.wallet !== "";
            content = `
                <div class="modal-header">CRYPTO WALLET</div>
                <div style="text-align:center; padding: 20px;">
                    <div style="font-size: 50px; margin-bottom: 10px;">💎</div>
                    ${isConnected ? 
                        `<p style="color:var(--accent)">Status: Connected</p>
                         <p style="font-size:10px; opacity:0.6;">${u.wallet}</p>` : 
                        `<p>Connect your TON wallet to receive rewards.</p>
                         <button class="back-btn" onclick="logic.connectWallet()" style="background:var(--accent); color:#000; width:100%; margin-top:15px; font-weight:bold;">CONNECT TON</button>`
                    }
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else if (id === 'top') {
            content = `
                <div class="modal-header">GLOBAL TOP</div>
                <div class="upgrade-card" style="border: 1px solid var(--accent)">
                    <b>1. ${u.username} (You)</b>
                    <span>${Math.floor(u.balance).toLocaleString()} 💰</span>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            content = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; padding:20px;">System expansion in progress...</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }

        m.querySelector('.modal-content').innerHTML = content;
        m.classList.add('active');
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        const x = e?.clientX || window.innerWidth / 2;
        const y = e?.clientY || window.innerHeight / 2;
        n.style.left = `${x}px`;
        n.style.top = `${y}px`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
