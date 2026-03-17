const ui = {
    currentModal: null,

    init() {
        this.update();
        
        // Назначаем клик на логотип
        const target = document.getElementById('tap-target');
        if (target) {
            target.onpointerdown = (e) => logic.tap(e);
        }

        // Кнопка "Назад" в самом Telegram
        if (window.Telegram?.WebApp) {
            Telegram.WebApp.BackButton.onClick(() => this.closeM());
        }
    },

    update() {
        if (!logic.user) return;

        // Элементы из твоего HTML
        const bEl = document.getElementById('balance');
        const eVEl = document.getElementById('eng-val');
        const eFEl = document.getElementById('eng-fill');
        const tVEl = document.getElementById('tap-val');
        const pVEl = document.getElementById('profit-val');
        const lVEl = document.getElementById('u-lvl');

        // Используем Math.floor, чтобы не было дробей (баг 3.8.8)
        if (bEl) bEl.innerText = Math.floor(logic.user.balance).toLocaleString();
        if (tVEl) tVEl.innerText = `+${logic.user.click_lvl}`;
        if (pVEl) pVEl.innerText = Math.floor(logic.user.profit_hr);
        if (lVEl) lVEl.innerText = `LVL ${logic.user.lvl}`;
        
        if (eVEl) eVEl.innerText = `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`;
        if (eFEl) {
            const pct = (logic.user.energy / logic.user.max_energy * 100);
            eFEl.style.width = pct + '%';
        }
    },

    openM(id) {
        if (this.currentModal) this.closeM();
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            if (window.Telegram?.WebApp) {
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
                Telegram.WebApp.BackButton.show();
            }
        }
    },

    closeM() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal = null;
            if (window.Telegram?.WebApp) {
                Telegram.WebApp.BackButton.hide();
            }
        }
    }
};
