const ui = {
    // Инициализация событий тапа и сброс старых слушателей
    init() {
        console.log("🎨 UI: Ready");
        const target = document.getElementById('tap-target');
        
        if (target) {
            // Очистка событий через клон, чтобы избежать дублирования кликов
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

    // Обновление статов на главном экране (баланс, энергия и т.д.)
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

    // Открытие модальных окон
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
            // Переинициализируем кнопку, если модалка открылась
            if (logic.tonConnectUI) {
                logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }
        } 
        else if (id === 'top') {
            container.innerHTML = `
                <div class="modal-header">LEADERBOARD (100)</div>
                <div id="top-list-container" style="height: 350px; overflow-y: auto; padding: 5px; scrollbar-width: thin; opacity:0.5; text-align:center;">
                   <p>Loading leaderboard...</p>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            this.loadTop();
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

    async loadTop() {
        const topContainer = document.getElementById('top-list-container');
        if (!topContainer) return;

        try {
            const res = await fetch('/api/top');
            if (!res.ok) throw new Error("Load Top failed");
            const topData = await res.json();

            topContainer.innerHTML = '';
            topContainer.style.opacity = '1';
            topContainer.style.textAlign = 'left';

            let listHtml = '';
            
            topData.forEach((player, index) => {
                const rank = index + 1;
                let color = rank === 1 ? '#ffd700' : (rank === 2 ? '#c0c0c0' : (rank === 3 ? '#cd7f32' : '#fff'));
                let shadow = rank <= 3 ? `text-shadow: 0 0 10px ${color};` : '';
                const isYou = String(player.user_id) === String(logic.user.user_id);

                listHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 8px; border-bottom:1px solid #222; ${isYou ? 'background:rgba(0,255,255,0.08); border-radius:8px;' : ''}">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${player.photo_url || 'logo.png'}" style="width:28px; height:28px; border-radius:50%; border:1px solid ${color};">
                            <span style="color:${color}; font-weight:bold; ${shadow} font-size:14px;">${rank}. ${player.name || 'Agent'}</span>
                        </div>
                        <span style="font-family:monospace; font-size:13px;">${Math.floor(player.balance).toLocaleString()}</span>
                    </div>
                `;
            });

            topContainer.innerHTML = listHtml || '<p style="text-align:center;">No data available</p>';

        } catch (e) {
            console.error(e);
            topContainer.innerHTML = '<p style="color:red; text-align:center;">Failed to load leaderboard</p>';
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
