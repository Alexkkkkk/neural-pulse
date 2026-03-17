const ui = {
    // Обновление всех элементов экрана
    render() {
        const s = logic.state;
        document.getElementById('balance').innerText = Math.floor(s.balance).toLocaleString();
        document.getElementById('u-name').innerText = s.name;
        document.getElementById('u-lvl').innerText = `LVL ${s.level}`;
        document.getElementById('eng-val').innerText = `${s.energy} / ${s.maxEnergy}`;
        document.getElementById('eng-fill').style.width = `${(s.energy / s.maxEnergy) * 100}%`;
    },

    // Обработка тапа по логотипу
    handleTap(e) {
        if (logic.tap()) {
            this.render();
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
            // Эффект нажатия
            e.target.style.transform = 'scale(0.95)';
            setTimeout(() => e.target.style.transform = 'scale(1)', 50);
            logic.save();
        }
    },

    openM(id) {
        document.getElementById(`m-${id}`).style.display = 'flex';
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }
};

// Запуск интервала обновления
setInterval(() => {
    logic.regen();
    ui.render();
}, 1000);
