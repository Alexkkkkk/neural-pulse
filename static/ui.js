const ui = {
    init() {
        console.log("🎨 UI: Ready");
        const target = document.getElementById('tap-target');
        
        if (target) {
            // Очистка старых слушателей через клон
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
                    <div style="font-size:40px; margin-bottom:10px;">💎</div>
                    <div id="ton-connect-btn" style="display:inline-block;"></div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } 
        else if (id === 'mine') {
            const upgrades = [
                { id: 'cpu', name: 'Neural CPU', price: 500, profit: 100, icon: '🧠' },
                { id: 'gpu', name: 'GPU Cluster', price: 2500, profit: 550, icon: '⚡' },
                { id: 'node', name: 'Validator Node', price: 10000, profit: 2400, icon: '🌐' }
            ];

            let listHtml = upgrades.map(upg => `
                <div class="upgrade-card" onclick="ui.buyUpg('${upg.id}', ${upg.price}, ${upg.profit}, 'mine')">
                    <div style="font-size:24px;">${upg.icon}</div>
                    <div style="flex-grow:1; margin-left:15px;">
                        <div style="font-weight:bold;">${upg.name}</div>
                        <small style="color:#00ff88;">+${upg.profit}/hr</small>
                    </div>
                    <div class="price-tag">💰 ${upg.price}</div>
                </div>
            `).join('');

            container.innerHTML = `<div class="modal-header">MINING</div>${listHtml}<button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }
        else if (id === 'boost') {
            const nextPrice = logic.user.click_lvl * 1000;
            container.innerHTML = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.buyUpg('tap', ${nextPrice}, 1, 'boost')">
                    <div style="font-size:24px;">🚀</div>
                    <div style="flex-grow:1; margin-left:15px;"><b>Multitap</b><br><small>Level Up Click</small></div>
                    <div class="price-tag">💰 ${nextPrice}</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } else {
            container.innerHTML = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; opacity:0.5;">COMING SOON</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }
    },

    buyUpg(id, price, val, type) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            if (type === 'mine') logic.user.profit_hr += val;
            if (type === 'boost') logic.user.click_lvl += val;
            this.update();
            logic.save();
            this.openM(type);
        } else {
            // Визуальный эффект нехватки денег
            const card = event.currentTarget;
            card.style.borderColor = "red";
            setTimeout(() => card.style.borderColor = "", 300);
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
