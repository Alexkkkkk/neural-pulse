const ui = {
    currentModal: null,

    init() {
        this.update();
        
        const target = document.getElementById('tap-target');
        if (target) {
            // Используем pointerdown для мгновенного отклика без задержек
            target.onpointerdown = (e) => {
                if (window.logic) logic.tap(e);
            };
        }

        // Привязываем системную кнопку "Назад" в Telegram к закрытию модалок
        if (window.Telegram?.WebApp) {
            Telegram.WebApp.BackButton.onClick(() => this.closeM());
        }
    },

    update() {
        // Защита: если объект logic или user еще не загружен, прерываем обновление
        if (!window.logic || !logic.user) return;

        const balanceEl = document.getElementById('balance');
        const engValEl = document.getElementById('eng-val');
        const engFillEl = document.getElementById('eng-fill');

        // Math.floor решает проблему длинных дробей
        if (balanceEl) balanceEl.innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');
        
        if (engValEl) engValEl.innerText = `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`;
        
        if (engFillEl) engFillEl.style.width = (logic.user.energy / logic.user.max_energy * 100) + '%';
    },

    openM(id) {
        // Если уже открыто другое окно, закрываем его
        if (this.currentModal) this.closeM();
        
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
            
            // Легкая вибрация и показ кнопки "Назад"
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
            
            // Прячем кнопку "Назад"
            if (window.Telegram?.WebApp) {
                Telegram.WebApp.BackButton.hide();
            }
        }
    }
};
