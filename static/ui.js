const ui = {
    init() {
        console.log("🎨 UI: Initializing...");
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
        set('tap-val', `+${u.click_lvl}`);
        set('profit-val', Math.floor(u.profit_hr).toLocaleString('ru-RU'));
        set('u-lvl', `LVL ${u.lvl}`);
        set('eng-val', `${Math.floor(u.energy)}/${u.max_energy}`);

        const fill = document.getElementById('eng-fill');
        if (fill) {
            const pct = (u.energy / u.max_energy) * 100;
            fill.style.width = `${pct}%`;
        }
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
                    <p style="color:#aaa; font-size:13px; margin-top:15px;">
                        Подключите ваш TON кошелек для будущих аирдропов.
                    </p>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            
            // Задержка важна для корректной инициализации кнопки кошелька
            setTimeout(() => {
                if (logic.tonConnectUI) {
                    logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
                }
            }, 100);
        } 
        else if (id === 'top') {
            container.innerHTML = `
                <div class="modal-header">LEADERBOARD (100)</div>
                <div id="top-list-container" style="height: 350px; overflow-y: auto; padding: 10px;">
                    <p style="text-align:center; opacity:0.5;">Loading records...</p>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            this.loadTop();
        }
    },

    async loadTop() {
        const topContainer = document.getElementById('top-list-container');
        if (!topContainer) return;

        try {
            const res = await fetch('/api/top');
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            const topData = await res.json();

            if (!topData || topData.length === 0) {
                topContainer.innerHTML = '<p style="text-align:center; padding:20px;">No players found</p>';
                return;
            }

            topContainer.innerHTML = topData.map((player, index) => `
                <div class="top-item ${String(player.user_id) === String(logic.user?.user_id) ? 'is-me' : ''}" 
                     style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #222;">
                    <div style="display:flex; align-items:center;">
                        <span style="width:25px; opacity:0.6;">${index + 1}</span>
                        <img src="${player.photo_url || 'logo.png'}" style="width:30px; height:30px; border-radius:50%; margin: 0 10px;">
                        <span>${player.name || 'Agent'}</span>
                    </div>
                    <span style="font-weight:bold; color:#00f2ff;">${Math.floor(player.balance).toLocaleString()}</span>
                </div>
            `).join('');

        } catch (e) {
            topContainer.innerHTML = `<p style="color:#ff4444; text-align:center; padding:20px;">Error: ${e.message}</p>`;
        }
    },

    closeM() { 
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); 
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        n.style.left = `${e.clientX}px`;
        n.style.top = `${e.clientY}px`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
