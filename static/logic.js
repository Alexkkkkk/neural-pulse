const logic = {
    user: null,

    // Добавляем аргументы для инициализации данными из Telegram
    async init(userIdFromTg = null, userNameFromTg = null, photoUrlFromTg = null) {
        const tg = window.Telegram?.WebApp;
        if (tg) { 
            tg.ready(); 
            tg.expand(); 
            // Устанавливаем цвет темы (черный для киберпанк стиля)
            tg.setHeaderColor('#000000');
        }

        // Приоритет данным из аргументов (из SDK), если нет — берем из unsafe или заглушку
        const userId = userIdFromTg || tg?.initDataUnsafe?.user?.id || "12345";
        const firstName = userNameFromTg || tg?.initDataUnsafe?.user?.first_name || "Agent";
        const photoUrl = photoUrlFromTg || tg?.initDataUnsafe?.user?.photo_url || null;

        try {
            // Запрашиваем данные у нашего Node.js сервера, передавая username и photo_url
            const res = await fetch(`/api/user/${userId}?username=${encodeURIComponent(firstName)}&photo_url=${encodeURIComponent(photoUrl || '')}`);
            const data = await res.json();

            this.user = {
                user_id: String(userId),
                username: data.username || firstName,
                photo_url: data.photo_url || photoUrl, // Сохраняем URL аватарки в объекте пользователя
                balance: Number(data.balance || 0),
                energy: Number(data.energy ?? 1000),
                max_energy: Number(data.max_energy || 1000),
                click_lvl: Number(data.click_lvl || 1),
                profit_hr: Number(data.profit_hr || 0),
                lvl: Number(data.lvl || 1)
            };

            // Обновляем имя и аватар в интерфейсе сразу после загрузки
            const nameEl = document.getElementById('u-name');
            if (nameEl) nameEl.innerText = this.user.username;
            
            const avatarEl = document.getElementById('u-avatar');
            if (avatarEl && this.user.photo_url) {
                avatarEl.src = this.user.photo_url;
            }

            if (typeof ui !== 'undefined') ui.init();
            
            this.startLoops();
            return true;
        } catch (e) {
            console.error("Neural Pulse Init Error:", e);
            return false;
        }
    },

    tap(e) {
        // Предотвращаем стандартное поведение (зум/скролл) на мобилках
        if (e.type === 'touchstart') e.preventDefault();
        if (!this.user || this.user.energy < this.user.click_lvl) return;
        
        this.user.balance += this.user.click_lvl;
        this.user.energy -= this.user.click_lvl;
        
        // Проверка на повышение уровня
        this.checkLvl();

        if (typeof ui !== 'undefined') ui.update();
        this.anim(e);

        // Виброотклик Telegram
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    },

    checkLvl() {
        // Уровень растет от общего баланса
        const newLvl = Math.floor(this.user.balance / 100000) + 1;
        if (newLvl > this.user.lvl) {
            this.user.lvl = newLvl;
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        }
    },

    anim(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const p = document.createElement('div');
        p.className = 'tap-pop';
        p.innerText = `+${this.user.click_lvl}`;
        p.style.left = `${clientX}px`;
        p.style.top = `${clientY}px`;
        
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 800);
    },

    async buyUpgrade(type) {
        if (!this.user) return;
        
        let success = false;
        if (type === 'tap' && this.user.balance >= 5000) {
            this.user.balance -= 5000;
            this.user.click_lvl += 1;
            success = true;
        } else if (type === 'energy' && this.user.balance >= 10000) {
            this.user.balance -= 10000;
            this.user.max_energy += 500;
            this.user.energy += 500;
            success = true;
        } else if (type === 'profit' && this.user.balance >= 25000) {
            this.user.balance -= 25000;
            this.user.profit_hr += 500;
            success = true;
        }

        if (success) {
            if (typeof ui !== 'undefined') {
                ui.update();
                // Обновляем модалку
                ui.openM(type === 'profit' ? 'mine' : 'boost'); 
            }
            await this.save();
        } else {
            window.Telegram?.WebApp?.showAlert("Insufficient balance for this protocol!");
        }
    },

    async claimTask(taskId, reward, url = null) {
        if (!this.user) return;
        
        if (url) {
            window.Telegram.WebApp.openLink(url);
        }

        this.user.balance += reward;
        window.Telegram?.WebApp?.showAlert(`Protocol Verified! +${reward.toLocaleString()} Pulse`);
        
        if (typeof ui !== 'undefined') ui.update();
        await this.save();
    },

    async save() {
        if (!this.user) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.user_id,
                    balance: Math.floor(this.user.balance),
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: this.user.profit_hr,
                    lvl: this.user.lvl
                })
            });
            console.log("🧬 Sync: OK");
        } catch (err) { 
            console.warn("Sync failed", err); 
        }
    },

    startLoops() {
        // Цикл обновлений (1 раз в секунду)
        setInterval(() => {
            if (!this.user) return;
            
            // Регенерация энергии
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1.5);
            }
            
            // Пассивный доход
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            
            if (typeof ui !== 'undefined') ui.update();
        }, 1000);

        // Автосохранение раз в 15 секунд
        setInterval(() => this.save(), 15000);
    }
};
