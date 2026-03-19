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
        set('tap-val', `+${u.click_lvl}`);
        set('profit-val', Math.floor(u.profit_hr).toLocaleString('ru-RU'));
        set('u-lvl', `LVL ${u.lvl}`);
        set('eng-val', `${Math.floor(u.energy)}/${u.max_energy}`);

        const fill = document.getElementById('eng-fill');
        if (fill) {
            fill.style.width = `${(u.energy / u.max_energy) * 100}%`;
        }
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        m.classList.add('active');
        const container = m.querySelector('.modal-content');
        const u = logic.user;

        if (id === 'wallet') {
            const isConnected = logic.tonConnectUI?.connected;
            container.innerHTML = `
                <div class="modal-header">TON WALLET</div>
                <div style="padding:20px; text-align:center;">
                    <img src="logo.png" style="width:60px; margin-bottom:15px; filter: hue-rotate(150deg);">
                    <p style="color:#aaa; font-size:14px; margin-bottom:20px;">
                        ${isConnected ? "Кошелек подключен. Ожидайте листинга!" : "Подключите ваш TON кошелек для вывода средств."}
                    </p>
                    <div id="ton-connect-btn" style="display:flex; justify-content:center;"></div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            if (logic.tonConnectUI) {
                logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }
        } 
        else if (id === 'top') {
            // Генерация ТОП-100
            let listHtml = '';
            for (let i = 1; i <= 100; i++) {
                let color = i === 1 ? '#ffd700' : (i === 2 ? '#c0c0c0' : (i === 3 ? '#cd7f32' : '#fff'));
                let shadow = i <= 3 ? `text-shadow: 0 0 10px ${color};` : '';
                
                // Для примера генерируем случайные балансы, кроме игрока
                let score = i === 42 ? Math.floor(u.balance) : Math.floor(10000000 / i);
                let name = i === 42 ? "YOU" : `Agent_${i}${i*7}`;

                listHtml += `
                    <div style="display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid #222; font-size:14px; ${i === 42 ? 'background:rgba(0,255,255,0.1); border-radius:8px;' : ''}">
                        <span style="color:${color}; font-weight:bold; ${shadow}">${i}. ${name}</span>
                        <span style="font-family:monospace;">${score.toLocaleString()}</span>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="modal-header">LEADERBOARD (100)</div>
                <div style="height: 350px; overflow-y: auto; padding: 5px; scrollbar-width: thin;">
                    ${listHtml}
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
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
            const nextTapPrice = (u.click_lvl * 1500);
            container.innerHTML = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.buyUpg('tap', ${nextTapPrice}, 1, 'boost')">
                    <b>Multitap</b><br><small>+1 PER CLICK</small>
                    <div class="price-tag">💰 ${nextTapPrice}</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
        else if (id === 'squad') {
            const refLink = `https://t.me/n_pulse_bot?start=${u.user_id}`;
            container.innerHTML = `
                <div class="modal-header">FRIENDS</div>
                <div style="padding:20px; text-align:center;">
                    <p>Invite friends and get 10% bonus!</p>
                    <div style="background:#111; padding:10px; border-radius:8px; margin:15px 0; font-size:12px; word-break:break-all; border:1px solid #333;">${refLink}</div>
                    <button class="nav-btn" style="width:100%" onclick="navigator.clipboard.writeText('${refLink}'); alert('Copied!')">COPY LINK</button>
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
            this.openM(type);
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
