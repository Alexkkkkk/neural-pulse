const ui = {
    currentModal: null,

    init() {
        this.update();
        const target = document.getElementById('tap-target');
        if (target) {
            target.onpointerdown = (e) => logic.tap(e);
        }
        if (window.Telegram?.WebApp) {
            Telegram.WebApp.BackButton.onClick(() => this.closeM());
        }
    },

    update() {
        const bal = document.getElementById('balance');
        const enV = document.getElementById('eng-val');
        const enF = document.getElementById('eng-fill');
        const tV = document.getElementById('tap-val');
        const pV = document.getElementById('profit-val');
        const lvl = document.getElementById('u-lvl');

        if (bal) bal.innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');
        if (tV) tV.innerText = `+${logic.user.click_lvl}`;
        if (pV) pV.innerText = Math.floor(logic.user.profit_hr).toLocaleString('ru-RU');
        if (lvl) lvl.innerText = `LVL ${logic.user.lvl}`;
        
        if (enV) enV.innerText = `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`;
        if (enF) enF.style.width = (logic.user.energy / logic.user.max_energy * 100) + '%';
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
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.hide();
        }
    }
};
