const ui = {
    currentModal: null,

    // 1. Инициализация (добавлена поддержка кнопки "Назад" в Telegram)
    init() {
        this.update();
        if (window.Telegram?.WebApp) {
            Telegram.WebApp.BackButton.onClick(() => this.closeM());
        }
        console.log("Neural Pulse UI Manager v3.8.0 stable loaded");
    },

    // 2. Обновление всех элементов интерфейса
    update() {
        // Защита: если logic еще не загружен, выходим
        if (!window.logic || !logic.user) return;

        const bEl = document.getElementById('balance');
        const eT = document.getElementById('eng-val');
        const eF = document.getElementById('eng-fill');
        const lEl = document.getElementById('u-lvl');
        const pEl = document.getElementById('profit-val');
        const tV = document.getElementById('tap-val');

        // ГЛАВНОЕ ИСПРАВЛЕНИЕ: Используем Math.floor + localString
        // Баланс будет отображаться как "2 471 111 111"
        if (bEl) bEl.innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');
        
        if (eT) eT.innerText = `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`;
        
        if (eF) {
            const pct = (logic.user.energy / logic.user.max_energy * 100);
            eF.style.width = pct + '%';
        }
        
        if (lEl) lEl.innerText = `LVL ${logic.user.level}`;
        if (pEl) pEl.innerText = Math.floor(logic.user.profit);
        if (tV) tV.innerText = `+${logic.user.tap_val}`;
    },

    // 3. Открытие модальных окон
    openM(id) {
        if (this.currentModal) this.closeM();
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            // Показываем кнопку "Назад" в Telegram
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.show();
        }
    },

    // 4. Закрытие модальных окон
    closeM() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal = null;
            // Прячем кнопку "Назад" в Telegram
            if (window.Telegram?.WebApp) Telegram.WebApp.BackButton.hide();
        }
    }
};
