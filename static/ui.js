const ui = {
    // Инициализация кликера и событий
    init() {
        console.log("🎨 UI: Ready");
        const target = document.getElementById('tap-target');
        
        if (target) {
            // Очистка событий через клонирование, чтобы избежать дублирования кликов
            const newTarget = target.cloneNode(true);
            target.replaceWith(newTarget);

            const handleTap = (e) => {
                e.preventDefault();
                // Поддержка и тачскрина, и мышки
                const pos = e.touches ? e.touches[0] : e;
                logic.tap({ clientX: pos.clientX, clientY: pos.clientY });
            };

            newTarget.addEventListener('touchstart', handleTap, { passive: false });
            newTarget.addEventListener('mousedown', handleTap);
        }
        this.update();
    },

    // Главная функция обновления всех цифр на экране
    update() {
        if (!logic.user) return;
        const u = logic.user;
        
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        // Форматируем числа (например, 1 000 000)
        set('balance', Math.floor(u.balance).toLocaleString('ru-RU'));
        set('tap-val', `+${u.click_lvl}`);
        set('profit-val', Math.floor(u.profit_hr).toLocaleString('ru-RU'));
        set('u-lvl', `LVL ${u.lvl}`);
        set('eng-val', `${Math.floor(u.energy)}/${u.max_energy}`);

        // Полоска энергии
        const fill = document.getElementById('eng-fill');
        if (fill) {
            const pct = (u.energy / u.max_energy) * 100;
            fill.style.width = `${pct}%`;
        }
    },

    // Управление модальными окнами
    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        m.classList.add('active');
        const container = m.querySelector('.modal-content');
        const u = logic.user;

        // --- КОШЕЛЕК ---
        if (id === 'wallet') {
            container.innerHTML = `
                <div class="modal-header">TON WALLET</div>
                <div style="padding:30px; text-align:center;">
                    <p style="margin-bottom:20px; color:#aaa;">Connect your wallet for future airdrops</p>
                    <div id="ton-connect-btn"></div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            if (logic.tonConnectUI) {
                logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }
        } 
        // --- МАЙНИНГ (Пассивный доход) ---
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
        // --- БУСТЫ (Клик) ---
        else if (id === 'boost') {
            const nextTapPrice = (u.click_lvl * 1500);
            container.innerHTML = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.buyUpg('tap', ${nextTapPrice}, 1, 'boost')">
                    <b>Multitap</b><br><small>+1 PER CLICK</small>
                    <div class="price-tag">💰 ${nextTapPrice}</div>
                </div>
                <div class="upgrade-card" onclick="ui.buyUpg('energy', 1000, 500, 'energy')">
                    <b>Energy Cap</b><br><small>+500 MAX ENERGY</small>
                    <div class="price-tag">💰 1000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
        // --- ЗАДАНИЯ ---
        else if (id === 'tasks') {
            container.innerHTML = `
                <div class="modal-header">TASKS</div>
                <div class="upgrade-card" onclick="window.open('https://t.me/your_channel')">
                    <b>Join Channel</b><br><small>+5,000 BP</small>
                    <div class="price-tag">🔗 JOIN</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
        // --- ДРУЗЬЯ ---
        else if (id === 'squad') {
            const refLink = `https://t.me/n_pulse_bot?start=${u.user_id}`;
            container.innerHTML = `
                <div class="modal-header">FRIENDS</div>
                <div style="padding:20px; text-align:center;">
                    <p>Invite friends and get 10% of their earnings!</p>
                    <input type="text" value="${refLink}" readonly style="width:100%; background:#222; color:#fff; border:1px solid #444; padding:10px; margin:15px 0; border-radius:8px;">
                    <button class="nav-btn" style="width:100%" onclick="navigator.clipboard.writeText('${refLink}'); alert('Copied!')">COPY LINK</button>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
        // --- ТОП ---
        else if (id === 'top') {
            container.innerHTML = `
                <div class="modal-header">TOP PLAYERS</div>
                <div style="padding:10px;">
                    <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333;">
                        <span>1. Satoshi</span><span>999,999,999</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333; color: cyan;">
                        <span>Ваше место:</span><span>${Math.floor(u.balance).toLocaleString()}</span>
                    </div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
    },

    // Логика покупки улучшений
    buyUpg(id, price, val, type) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            
            if (type === 'mine') logic.user.profit_hr += val;
            if (type === 'boost') logic.user.click_lvl += val;
            if (type === 'energy') logic.user.max_energy += val;
            
            this.update();
            logic.save(); // Отправляем данные на сервер
            this.openM(type); // Перерисовываем модалку, чтобы обновить цену
        } else {
            alert("Not enough balance!");
        }
    },

    // Закрыть все окна
    closeM() { 
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); 
    },

    // Анимация вылетающих цифр при клике
    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        
        // Позиционируем в месте клика
        n.style.left = `${e.clientX}px`;
        n.style.top = `${e.clientY}px`;
        
        document.body.appendChild(n);
        
        // Удаляем элемент после завершения анимации
        setTimeout(() => n.remove(), 800);
    }
};
