const ui = {
    init() {
        console.log("🎨 UI: Ready");
        const target = document.getElementById('tap-target');
        if (target) {
            const newTarget = target.cloneNode(true);
            target.replaceWith(newTarget);
            const handleTap = (e) => {
                e.preventDefault();
                const pos = e.touches ? e.touches[0] : e;
                logic.tap({ clientX: pos.clientX, clientY: pos.clientY });
            };
            newTarget.addEventListener('touchstart', handleTap, { passive: false });
            newTarget.addEventListener('mousedown', handleTap);
        }
        this.update();
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
            container.innerHTML = `
                <div class="modal-header">TON WALLET</div>
                <div style="padding:20px; text-align:center;">
                    <div id="ton-connect-btn" style="display:flex; justify-content:center; min-height:40px;"></div>
                    <p style="color:#aaa; font-size:12px; margin-top:15px;">Connect for Airdrop eligibility</p>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            setTimeout(() => {
                if (logic.tonConnectUI) logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }, 100);
        } 
        else if (id === 'top') {
            container.innerHTML = `<div class="modal-header">LEADERBOARD</div><div id="top-list-container" style="height:300px; overflow-y:auto;">Loading...</div><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
            this.loadTop();
        }
        else if (id === 'squad') {
            const refLink = `https://t.me/neural_pulse_bot?start=${logic.user.user_id}`;
            container.innerHTML = `
                <div class="modal-header">SQUAD</div>
                <div style="padding:20px; text-align:center;">
                    <h3 style="margin-bottom:10px;">Invite Friends</h3>
                    <p style="font-size:13px; color:#888;">Get 10,000 for each friend!</p>
                    <input type="text" value="${refLink}" readonly style="width:100%; background:#111; border:1px solid #333; color:#fff; padding:10px; margin:15px 0; border-radius:8px;">
                    <button class="back-btn" style="background:#00f2ff; color:#000;" onclick="navigator.clipboard.writeText('${refLink}')">COPY LINK</button>
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
                <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #222;">
                    <span>${i+1}. ${p.name}</span>
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
