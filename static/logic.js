
const logic = {
    user: null,

    async init() {
        console.log("🚀 Logic Booting...");
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            tg.enableClosingConfirmation();
        }

        // Берем ID и Имя из Телеграма
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const firstName = tg?.initDataUnsafe?.user?.first_name || "Agent";

        try {
            // Исправлено: передаем username для базы данных
            const res = await fetch(`/api/user/${userId}?username=${encodeURIComponent(firstName)}`);
            
            if (!res.ok) throw new Error(`Server status: ${res.status}`);
            
            const data = await res.json();
            if (data.error) throw new Error(`DB Error: ${data.error}`);

            this.user = {
                user_id: String(userId),
                username: data.username || firstName,
                balance: Number(data.balance || 0),
                energy: Number(data.energy !== undefined ? data.energy : 1000),
                max_energy: Number(data.max_energy || 1000),
                click_lvl: Number(data.click_lvl || 1),
                profit_hr: Number(data.profit_hr || 0),
                lvl: Number(data.lvl || 1),
                wallet: data.wallet || null
            };

            const nameEl = document.getElementById('u-name');
            if (nameEl) nameEl.innerText = this.user.username;

            this.startLoops();
            ui.init(); 
            return true; // Разрешаем убрать экран загрузки
        } catch (e) {
            console.error("Init Error", e);
            // Если ошибка — пишем её на экране загрузки красным
            const loadTxt = document.querySelector('.loading-text');
            if (loadTxt) {
                loadTxt.innerText = `ERROR: ${e.message}`;
                loadTxt.style.color = "#ff4444";
            }
            return false;
        }
    },

    tap(e) {
        if (!this.user || this.user.energy < 1) return;
        this.user.balance += this.user.click_lvl;
        this.user.energy -= 1;
        ui.update();
        this.anim(e);
    },

    anim(e) {
        const x = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const y = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        const p = document.createElement('div');
        p.className = 'tap-pop';
        p.innerText = `+${this.user.click_lvl}`;
        p.style.left = `${x - 20}px`;
        p.style.top = `${y - 40}px`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 800);
    },

    async save() {
        if (!this.user) return;
        fetch('/api/save', {
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
    },

    upgrade(type) {
        if (!this.user) return;
        let cost = type === 'tap' ? this.user.click_lvl * 1000 : (this.user.max_energy / 100) * 500;
        if (this.user.balance >= cost) {
            this.user.balance -= cost;
            if (type === 'tap') this.user.click_lvl++;
            else { this.user.max_energy += 500; this.user.lvl++; }
            ui.update();
            ui.openM('boost');
            this.save();
        } else { alert("Not enough balance!"); }
    },

    startLoops() {
        setInterval(() => {
            if (!this.user) return;
            if (this.user.energy < this.user.max_energy) this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
            if (this.user.profit_hr > 0) this.user.balance += (this.user.profit_hr / 3600);
            ui.update();
        }, 1000);
        setInterval(() => this.save(), 10000);
    }
};

// Запуск инициализации при загрузке окна
window.onload = () => logic.init();
