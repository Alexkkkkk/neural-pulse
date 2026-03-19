const ui = {
    init() {
        console.log("🎨 UI Init...");
        const target = document.getElementById('tap-target');
        
        if (target) {
            target.replaceWith(target.cloneNode(true));
            const newTarget = document.getElementById('tap-target');

            const handleTap = (e) => {
                e.preventDefault();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                logic.tap({ clientX, clientY });
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
            if (logic.tonConnectUI) {
                logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }
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

            container.innerHTML = `
                <div class="modal-header">MINING SHOP</div>
                <div style="padding:15px; display:flex; flex-direction:column; gap:10px;">
                    ${listHtml}
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
        else if (id === 'boost') {
            const nextTapPrice = logic.user.click_lvl * 1000;
            container.innerHTML = `
                <div class="modal-header">BOOSTERS</div>
                <div style="padding:15px;">
                    <div class="upgrade-card" onclick="ui.buyUpg('tap', ${nextTapPrice}, 1, 'boost')">
                        <div style="font-size:24px;">🚀</div>
                        <div style="flex-grow:1; margin-left:15px;">
                            <div style="font-weight:bold;">Multitap</div>
                            <small>Увеличить доход за клик</small>
                        </div>
                        <div class="price-tag">💰 ${nextTapPrice}</div>
                    </div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
        else {
            container.innerHTML = `
                <div class="modal-header">${id.toUpperCase()}</div>
                <div style="text-align:center; padding:40px; opacity:0.5;">COMING SOON</div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
    },

    buyUpg(id, price, val, type) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            if (type === 'mine') logic.user.profit_hr += val;
            if (type === 'boost') logic.user.click_lvl += val;
            
            this.update();
            logic.save();
            this.openM(type); // Обновляем окно магазина
        } else {
            const btn = event.currentTarget;
            btn.style.borderColor = "red";
            setTimeout(() => btn.style.borderColor = "", 300);
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
