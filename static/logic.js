const logic = {
    user: null,

    /**
     * Инициализация: Telegram, Загрузка данных, Запуск циклов
     */
    async init() {
        console.log("🚀 Logic: Initializing...");
        const tg = window.Telegram?.WebApp;
        
        if (tg) {
            tg.ready();
            tg.expand();
            tg.enableClosingConfirmation();
        }

        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const firstName = tg?.initDataUnsafe?.user?.first_name || "Agent";
        
        const nameEl = document.getElementById('u-name');
        if (nameEl) nameEl.innerText = firstName;

        try {
            const res = await fetch(`/api/user/${userId}`);
            if (!res.ok) throw new Error("API Connection Failed");
            const rawData = await res.json();
            
            this.user = {
                user_id: String(userId),
                username: firstName, 
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy !== undefined ? rawData.energy : 1000),
                max_energy: Number(rawData.max_energy || 1000),
                click_lvl: Number(rawData.click_lvl || 1),
                profit_hr: Number(rawData.profit_hr || 0),
                lvl: Number(rawData.lvl || 1),
                wallet: rawData.wallet || null
            };

            this.startLoops();
            ui.init(); 
            
            return true; 
        } catch (e) {
            console.error("❌ Logic Error:", e);
            ui.init();
            return false;
        }
    },

    /**
     * Обработка тапа
     */
    tap(e) {
        if (!this.user || this.user.energy < this.user.click_lvl) return;

        this.user.balance += this.user.click_lvl;
        this.user.energy -= this.user.click_lvl;
        
        // Обновляем визуальную часть
        ui.update();
        this.anim(e);
    },

    /**
     * Анимация вылетающих цифр (+1, +2 и т.д.)
     */
    anim(e) {
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        const n = document.createElement('div');
        n.innerText = `+${this.user.click_lvl}`;
        n.className = 'tap-anim'; // Убедись, что этот класс есть в style.css
        n.style.left = clientX + 'px';
        n.style.top = clientY + 'px';
        document.body.appendChild(n);

        setTimeout(() => n.remove(), 800);
    },

    /**
     * Система апгрейдов (вызывается из модалки BOOST)
     */
    upgrade(type) {
        if (!this.user) return;

        if (type === 'tap') {
            const cost = this.user.click_lvl * 1000;
            if (this.user.balance >= cost) {
                this.user.balance -= cost;
                this.user.click_lvl += 1;
                ui.update();
                ui.openM('boost'); // Обновляем окно, чтобы цена изменилась
                console.log("🔼 Tap Upgraded");
            } else {
                alert("Not enough coins!");
            }
        } 
        else if (type === 'energy') {
            const cost = this.user.lvl * 500;
            if (this.user.balance >= cost) {
                this.user.balance -= cost;
                this.user.max_energy += 500;
                this.user.lvl += 1; // Повышаем уровень за прокачку энергии
                ui.update();
                ui.openM('boost');
                console.log("🔼 Energy Upgraded");
            } else {
                alert("Not enough coins!");
            }
        }
    },

    /**
     * Игровые циклы
     */
    startLoops() {
        // Доход и реген каждую секунду
        setInterval(() => {
            if (!this.user) return;
            
            // Реген энергии (+2 в сек)
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 2);
            }
            
            // Пассивный доход
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            
            ui.update();
        }, 1000);

        // Сохранение раз в 10 секунд
        setInterval(() => this.save(), 10000);
    },

    /**
     * Сохранение на сервер
     */
    async save() {
        if (!this.user) return;
        try {
            const payload = {
                userId: this.user.user_id,
                balance: this.user.balance,
                energy: Math.floor(this.user.energy),
                max_energy: this.user.max_energy,
                click_lvl: this.user.click_lvl,
                profit_hr: this.user.profit_hr,
                lvl: this.user.lvl
            };

            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log("💾 Progress saved");
        } catch (e) { 
            console.warn("📡 Sync failed"); 
        }
    }
};

// Запуск при загрузке страницы
window.onload = () => logic.init();
