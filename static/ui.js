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

        // Обновление основных показателей интерфейса
        document.getElementById('balance').innerText = Math.floor(u.balance).toLocaleString('ru-RU');
        document.getElementById('tap-val').innerText = `+${u.click_lvl}`;
        document.getElementById('profit-val').innerText = Math.floor(u.profit_hr).toLocaleString('ru-RU');
        document.getElementById('u-lvl').innerText = `LVL ${u.lvl}`;
        document.getElementById('u-name').innerText = u.username || "Agent";
        
        // Обновление полоски энергии
        const engPct = (u.energy / u.max_energy) * 100;
        document.getElementById('eng-val').innerText = `${Math.floor(u.energy)}/${u.max_energy}`;
        const fill = document.getElementById('eng-fill');
        if (fill) fill.style.width = `${engPct}%`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;

        let content = "";
        const u = logic.user;

        switch(id) {
            case 'wallet':
                content = `
                    <div class="modal-header">TON WALLET</div>
                    <div style="display:flex; flex-direction:column; align-items:center; padding:20px; gap:15px;">
                        <div style="font-size:50px; filter: drop-shadow(0 0 10px var(--accent));">💎</div>
                        <p style="text-align:center; font-size:14px; color:#ccc; margin-bottom:10px;">
                            Подключите кошелек для будущих выплат и проверки транзакций.
                        </p>
                        <div id="ton-connect-btn"></div>
                    </div>
                    <button class="back-btn" onclick="ui.closeM()">BACK</button>
                `;
                break;

            case 'top':
                content = `
                    <div class="modal-header">GLOBAL TOP</div>
                    <div class="top-list" style="padding:10px; display:flex; flex-direction:column; gap:10px;">
                        <div class="upgrade-card" style="border: 1px solid var(--accent); background: rgba(0,255,242,0.05);">
                            <b>1. ${u.username} (You)</b>
                            <span style="color:var(--accent)">${Math.floor(u.balance).toLocaleString()} 💰</span>
                        </div>
                        <div class="upgrade-card" style="opacity:0.6;">
                            <b>2. Neural_Master</b>
                            <span>50 000 💰</span>
                        </div>
                        <div class="upgrade-card" style="opacity:0.6;">
                            <b>3. Crypto_King</b>
                            <span>12 500 💰</span>
                        </div>
                    </div>
                    <button class="back-btn" onclick="ui.closeM()">BACK</button>
                `;
                break;

            case 'mine':
            case 'boost':
                content = `
                    <div class="modal-header">${id.toUpperCase()}</div>
                    <div style="padding:40px 20px; text-align:center;">
                        <div style="font-size:40px; margin-bottom:15px;">🛠️</div>
                        <p style="opacity:0.7;">Улучшения станут доступны в следующем обновлении нейросети.</p>
                    </div>
                    <button class="back-btn" onclick="ui.closeM()">BACK</button>
                `;
                break;

            default:
                content = `
                    <div class="modal-header">${id.toUpperCase()}</div>
                    <div style="padding:40px 20px; text-align:center;">
                        <p style="opacity:0.5;">Раздел временно недоступен.</p>
                    </div>
                    <button class="back-btn" onclick="ui.closeM()">BACK</button>
                `;
        }

        const modalContent = m.querySelector('.modal-content');
        if (modalContent) modalContent.innerHTML = content;
        
        m.classList.add('active');
        
        // Автоматическая инициализация кнопки TON Connect при открытии Wallet
        if (id === 'wallet' && logic.tonConnectUI) {
            logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
        }
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    anim(e) {
        if (!e) return;
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        
        // Позиционирование всплывающего числа в месте клика
        const x = e.clientX || window.innerWidth / 2;
        const y = e.clientY || window.innerHeight / 2;
        
        n.style.left = `${x}px`;
        n.style.top = `${y}px`;
        
        document.body.appendChild(n);
        
        // Удаление элемента после завершения анимации
        setTimeout(() => n.remove(), 800);
    }
};
