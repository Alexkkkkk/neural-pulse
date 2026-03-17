const ui = {
    currentModal: null,

    init() {
        this.update();
        
        const target = document.getElementById('tap-target');
        if (target) {
            target.onpointerdown = (e) => {
                if (window.logic) logic.tap(e);
            };
        }

        if (window.Telegram?.WebApp) {
            Telegram.WebApp.BackButton.onClick(() => this.closeM());
        }
    },

    update() {
        if (!window.logic || !logic.user) return;

        const balanceEl = document.getElementById('balance');
        const engValEl = document.getElementById('eng-val');
        const engFillEl = document.getElementById('eng-fill');
        const profitEl = document.getElementById('profit-val');
        const lvlEl = document.getElementById('u-lvl');

        // Вывод целых чисел с разделением тысяч
        if (balanceEl) balanceEl.innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');
        if (profitEl) profitEl.innerText = `+${Math.floor(logic.user.profit_hr)}`;
        if (lvlEl) lvlEl.innerText = `LVL ${logic.user.lvl || 1}`;
        
        if (engValEl) engValEl.innerText = `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`;
        if (engFillEl) {
            const pct = (logic.user.energy / logic.user.max_energy * 100);
            engFillEl.style.width = pct + '%';
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
