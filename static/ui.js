const ui = {
    init() {
        console.log("🎨 UI: Ready");
        const target = document.getElementById('tap-target');
        
        if (target) {
            // Очистка событий через клон
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
                <div style="padding:30px; text-align:center;">
                    <div id="ton-connect-btn"></div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            // Принудительная вставка кнопки кошелька
            if (logic.tonConnectUI) {
                logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }
        } 
        else if (id === 'mine') {
            container.innerHTML = `
                <div class="modal-header">MINING CENTER</div>
                <div class="upgrade-card" onclick="ui.buyUpg('cpu', 500, 100, 'mine')">
                    <b>Neural CPU</b><br><small>+100 PROFIT/HR</small>
                    <div class="price-tag">💰 500</div>
                </div>
                <div class="upgrade-card" onclick="ui.buyUpg('gpu', 2000, 450, 'mine')">
                    <b>AI Cluster</b><br><small>+450 PROFIT/HR</small>
                    <div class="price-tag">💰 2000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        } 
        else if (id === 'boost') {
            const nextTapPrice = (logic.user.click_lvl * 1500);
            container.innerHTML = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.buyUpg('tap', ${nextTapPrice}, 1, 'boost')">
                    <b>Multitap</b><br><small>+1 PER CLICK</small>
                    <div class="price-tag">💰 ${nextTapPrice}</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
        else {
            container.innerHTML = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; padding:20px;">COMING SOON</p><button class="back-btn" onclick="ui.closeM()">BACK</button>`;
        }
    },

    buyUpg(id, price, val, type) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            if (type === 'mine') logic.user.profit_hr += val;
            if (type === 'boost') logic.user.click_lvl += val;
            
            this.update();
            logic.save();
            this.openM(type); // Обновляем текст в модалке (цены и т.д.)
        } else {
            alert("Not enough balance!");
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
