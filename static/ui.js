const ui = {
    init() {
        // Подключаем клик по логотипу
        const tapTarget = document.getElementById('tap-target');
        if (tapTarget) {
            // pointerdown работает быстрее и надежнее на мобилках, чем onclick
            tapTarget.addEventListener('pointerdown', (e) => this.handleTap(e));
        }

        // Запускаем цикл обновления энергии и экрана
        setInterval(() => {
            logic.regen();
            this.render();
        }, 1000);

        // Сохраняем данные раз в 5 секунд
        setInterval(() => {
            logic.saveToDB();
        }, 5000);

        this.render();
    },

    render() {
        const s = logic.state;
        document.getElementById('balance').innerText = Math.floor(s.balance).toLocaleString('en-US');
        document.getElementById('eng-val').innerText = `${s.energy} / ${s.maxEnergy}`;
        document.getElementById('eng-fill').style.width = `${(s.energy / s.maxEnergy) * 100}%`;
        document.getElementById('u-name').innerText = s.name;
        document.getElementById('u-lvl').innerText = `LVL ${s.clickLvl}`;
        document.getElementById('tap-val').innerText = `+${s.clickLvl}`;
        document.getElementById('profit-val').innerText = s.profitHr;
    },

    handleTap(e) {
        if (logic.tap()) {
            this.render();
            
            // Анимация уменьшения картинки при клике
            e.target.style.transform = 'scale(0.92)';
            setTimeout(() => e.target.style.transform = 'scale(1)', 100);
            
            // Вибрация Telegram
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }
    },

    openM(id) {
        const modal = document.getElementById(`m-${id}`);
        if(modal) {
            modal.style.display = 'flex';
            if (id === 'top') this.loadTopList();
        }
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    },

    async loadTopList() {
        const listDiv = document.getElementById('top-list');
        listDiv.innerHTML = "Загрузка...";
        try {
            const res = await fetch('/api/top');
            const data = await res.json();
            listDiv.innerHTML = data.map((u, i) => `
                <div class="top-item"><span>#${i+1} ${u.username}</span><b>${Math.floor(u.balance)}</b></div>
            `).join('');
        } catch (e) {
            listDiv.innerHTML = "Ошибка загрузки";
        }
    }
};
