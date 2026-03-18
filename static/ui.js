const ui = {
    currentModal: null,

    init() {
        this.update();
        if (window.Telegram?.WebApp) {
            Telegram.WebApp.BackButton.onClick(() => this.closeM());
        }
        console.log("Neural Pulse UI Manager v3.8.0 stable loaded");
    },

    update() {
        if (!window.logic || !logic.user) return;

        const bEl = document.getElementById('balance');
        const eT = document.getElementById('eng-val');
        const eF = document.getElementById('eng-fill');
        const lEl = document.getElementById('u-lvl');
        const pEl = document.getElementById('profit-val');
        const tV = document.getElementById('tap-val');

        // Вывод баланса с красивыми пробелами
        if (bEl) bEl.innerText = Math.floor(logic.user.balance || 0).toLocaleString('ru-RU');
        
        // Энергия
        if (eT) eT.innerText = `${Math.floor(logic.user.energy || 0)}/${logic.user.max_energy || 1000}`;
        if (eF) {
            const pct = (logic.user.energy / logic.user.max_energy * 100) || 0;
            eF.style.width = pct + '%';
        }
        
        // Уровень и доход (исправлены ключи под структуру БД)
        if (lEl) lEl.innerText = `LVL ${logic.user.lvl || 2}`;
        if (pEl) pEl.innerText = Math.floor(logic.user.profit_hr || 0).toLocaleString('ru-RU');
        if (tV) tV.innerText = `+${logic.user.click_lvl || 1}`;
    },

    openM(id) {
        if (this.currentModal) this.closeM();
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.show();
        }
    },

    closeM() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal = null;
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.hide();
        }
    }
};
