/**
 * logic.js — Ядро игровой механики Neural Pulse v3.8.8
 */
const logic = {
    state: {
        id: window.Telegram.WebApp.initDataUnsafe?.user?.id || "0",
        bal: 0, 
        lvl: 1, 
        eng: 1000,
        maxEng: 1000,
        name: window.Telegram.WebApp.initDataUnsafe?.user?.first_name || "Agent",
        ava: window.Telegram.WebApp.initDataUnsafe?.user?.photo_url || ""
    },

    // Запуск после экрана загрузки
    async start() {
        try {
            const r = await fetch(`/api/user/${this.state.id}?name=${encodeURIComponent(this.state.name)}&photo=${encodeURIComponent(this.state.ava)}`);
            const d = await r.json();
            
            // Синхронизация данных с сервером
            this.state.bal = parseFloat(d.balance) || 0;
            this.state.lvl = d.click_lvl || 1;
            this.state.eng = d.energy ?? 1000;
            this.state.maxEng = d.max_energy ?? 1000;

            ui.render(this.state);
            this.startEnergyRegen();
        } catch (e) {
            console.error("Ошибка инициализации логики:", e);
        }
    },

    // Обработка клика (тапа)
    tap(e) {
        // Проверка наличия энергии
        if (this.state.eng >= this.state.lvl) {
            this.state.bal += this.state.lvl;
            this.state.eng -= this.state.lvl;

            // Тактильная отдача Telegram
            if (window.Telegram.WebApp.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }

            // Анимация нажатия
            e.target.style.transform = 'scale(0.95)';
            setTimeout(() => e.target.style.transform = 'scale(1)', 50);

            ui.render(this.state);
            this.save();
        }
    },

    // Сохранение прогресса на сервер
    save() {
        fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: this.state.id, 
                balance: this.state.bal, 
                click_lvl: this.state.lvl,
                energy: this.state.eng
            })
        });
    },

    // Регенерация энергии (1 ед. в секунду)
    startEnergyRegen() {
        setInterval(() => {
            if (this.state.eng < this.state.maxEng) {
                this.state.eng += 1;
                ui.render(this.state);
            }
        }, 1000);
    },

    // Загрузка списка лидеров
    async loadTop() {
        try {
            const r = await fetch('/api/top');
            const d = await r.json();
            const topListContainer = document.getElementById('t-list');
            
            if (topListContainer) {
                topListContainer.innerHTML = d.map((u, i) => `
                    <div style="background:#0a0a0a; padding:15px; margin-top:10px; border-radius:12px; display:flex; justify-content:space-between; border: 1px solid #1a1a1a;">
                        <b>#${i + 1} ${u.username}</b> 
                        <span style="color:var(--cyan);">${Math.floor(u.balance).toLocaleString()}</span>
                    </div>`).join('');
            }
        } catch (e) {
            console.error("Ошибка загрузки ТОПа:", e);
        }
    }
};
