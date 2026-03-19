const logic = {
    user: null,
    tonConnectUI: null,

    async init() {
        console.log("🚀 Logic Init...");
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
        }

        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        
        try {
            const res = await fetch(`/api/user/${userId}`);
            const rawData = await res.json();
            
            this.user = {
                ...rawData,
                user_id: String(userId),
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy || 0),
                max_energy: Number(rawData.max_energy || 1000),
                click_lvl: Number(rawData.click_lvl || 1),
                profit_hr: Number(rawData.profit_hr || 0),
                lvl: Number(rawData.lvl || 1)
            };

            // Инициализация TON Connect если библиотека подключена
            if (typeof TonConnectUI !== 'undefined') {
                this.tonConnectUI = new TonConnectUI.TonConnectUI({
                    manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-btn'
                });
            }

            this.startLoops();
            return true; 
        } catch (e) {
            console.error("❌ DB Load Error:", e);
            return false;
        }
    },

    tap(e) {
        if (!this.user || this.user.energy < 1) return;

        this.user.balance += this.user.click_lvl;
        this.user.energy -= 1;
        
        ui.update();
        ui.anim(e);
    },

    startLoops() {
        setInterval(() => {
            if (!this.user) return;
            // Реген энергии
            if (this.user.energy < this.user.max_energy) this.user.energy += 1;
            // Пассивный доход
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            ui.update();
        }, 1000);

        setInterval(() => this.save(), 10000);
    },

    async save() {
        if (!this.user) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.user)
            });
        } catch (e) { console.log("Save failed"); }
    }
};

const ui = {
    init() {
        console.log("🎨 UI Init...");
        const target = document.getElementById('tap-target');
        
        if (target) {
            // Удаляем старые слушатели, чтобы не дублировались
            target.replaceWith(target.cloneNode(true));
            const newTarget = document.getElementById('tap-target');

            // Основной обработчик (touchstart для мобилок, mousedown для ПК)
            const handleTap = (e) => {
                e.preventDefault();
                // Берем координаты правильно для тача или мышки
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
        
        if (id === 'wallet') {
            const container = m.querySelector('.modal-content');
            container.innerHTML = `
                <div class="modal-header">TON WALLET</div>
                <div style="padding:20px; text-align:center;">
                    <div id="ton-connect-btn" style="display:inline-block;"></div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            // Перепривязываем кнопку кошелька если она есть
            if (logic.tonConnectUI) {
                logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }
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
