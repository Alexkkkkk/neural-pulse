const logic = {
    user: null,

    async init() {
        console.log("🚀 Neural Logic Booting...");
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            tg.enableClosingConfirmation();
        }

        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const firstName = tg?.initDataUnsafe?.user?.first_name || "Agent";

        try {
            const res = await fetch(`/api/user/${userId}?username=${encodeURIComponent(firstName)}`);
            if (!res.ok) throw new Error(`Server: ${res.status}`);
            
            const data = await res.json();
            if (data.error) throw new Error(`DB: ${data.error}`);

            // Синхронизация данных с сервера
            this.user = {
                user_id: String(userId),
                username: data.username || firstName,
                balance: Number(data.balance || 0),
                energy: Number(data.energy !== undefined ? data.energy : 1000),
                max_energy: Number(data.max_energy || 1000),
                click_lvl: Number(data.click_lvl || 1),
                profit_hr: Number(data.profit_hr || 0),
                lvl: Number(data.lvl || 1)
            };

            // Установка имени
            const nameEl = document.getElementById('u-name');
            if (nameEl) nameEl.innerText = this.user.username;

            // Инициализация UI и циклов
            if (typeof ui !== 'undefined') ui.init();
            this.startLoops();

            // Плавное скрытие загрузки
            const loader = document.getElementById('loading-screen');
            const app = document.getElementById('app');
            if (app) app.style.display = 'flex';
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }

            return true;
        } catch (e) {
            console.error("Init Error", e);
            const loadTxt = document.querySelector('.loading-text');
            if (loadTxt) {
                loadTxt.innerText = `ACCESS DENIED: ${e.message}`;
                loadTxt.style.color = "#ff4444";
            }
            return false;
        }
    },

    // Форматирование чисел (1234567 -> 1 234 567)
    formatNum(num) {
        return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    },

    tap(e) {
        if (!this.user || this.user.energy < this.user.click_lvl) return;

        // Логика клика
        this.user.balance += this.user.click_lvl;
        this.user.energy -= this.user.click_lvl;

        // Обновление UI
        if (typeof ui !== 'undefined') ui.update();
        this.anim(e);

        // Виброотклик
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
    },

    anim(e) {
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        
        const p = document.createElement('div');
        p.className = 'tap-pop';
        p.innerText = `+${this.user.click_lvl}`;
        p.style.left = `${clientX - 20}px`;
        p.style.top = `${clientY - 40}px`;
        
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 800);
    },

    async save() {
        if (!this.user) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.user_id,
                    balance: this.user.balance,
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: this.user.profit_hr,
                    lvl: this.user.lvl
                })
            });
        } catch (e) { console.error("Save failed", e); }
    },

    // Масштабируемая стоимость апгрейдов (как на скриншотах)
    getUpgradeCost(type) {
        if (type === 'tap') {
            return Math.floor(1000 * Math.pow(1.5, this.user.click_lvl - 1));
        } else {
            return Math.floor(500 * Math.pow(1.2, (this.user.max_energy / 500)));
        }
    },

    upgrade(type) {
        if (!this.user) return;
        const cost = this.getUpgradeCost(type);

        if (this.user.balance >= cost) {
            this.user.balance -= cost;
            if (type === 'tap') {
                this.user.click_lvl++;
            } else {
                this.user.max_energy += 500;
                this.user.energy = this.user.max_energy; // Восполняем при покупке
                this.user.lvl++; 
            }
            
            if (typeof ui !== 'undefined') {
                ui.update();
                ui.openM('boost'); // Перерисовать модалку с новыми ценами
            }
            this.save();
        } else {
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.showAlert("Недостаточно кредитов для апгрейда!");
            } else {
                alert("Not enough balance!");
            }
        }
    },

    startLoops() {
        // Каждую секунду: Реген энергии + пассивный доход
        setInterval(() => {
            if (!this.user) return;
            
            // Реген энергии (3 ед. в сек)
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 3);
            }

            // Доход в час
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }

            if (typeof ui !== 'undefined') ui.update();
        }, 1000);

        // Автосохранение каждые 10 сек
        setInterval(() => this.save(), 10000);
    }
};

window.onload = () => logic.init();
