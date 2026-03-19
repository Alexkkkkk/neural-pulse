const logic = {
    user: null,
    tonConnectUI: null,

    /**
     * Инициализация приложения: Telegram WebApp, загрузка данных и TON Connect
     */
    async init() {
        console.log("🚀 Logic: Initializing...");
        const tg = window.Telegram?.WebApp;
        
        if (tg) {
            tg.ready();
            tg.expand();
            // Подтверждение закрытия, чтобы не потерять прогресс между сохранениями
            tg.enableClosingConfirmation();
        }

        // 1. Извлекаем данные пользователя из Telegram
        const userId = tg?.initDataUnsafe?.user?.id || "12345";
        const firstName = tg?.initDataUnsafe?.user?.first_name || "Agent";
        const photoUrl = tg?.initDataUnsafe?.user?.photo_url || "/logo.png";
        
        // Отображаем имя игрока в главном интерфейсе
        const nameEl = document.getElementById('u-name');
        if (nameEl) nameEl.innerText = firstName;

        try {
            // 2. Загружаем прогресс с сервера
            const res = await fetch(`/api/user/${userId}`);
            if (!res.ok) throw new Error("API Connection Failed");
            const rawData = await res.json();
            
            // 3. Формируем объект пользователя (маппинг данных из БД)
            this.user = {
                user_id: String(userId),
                username: firstName, 
                photo_url: photoUrl, 
                balance: Number(rawData.balance || 0),
                energy: Number(rawData.energy !== undefined ? rawData.energy : 1000),
                max_energy: Number(rawData.max_energy || 1000),
                click_lvl: Number(rawData.click_lvl || 1),
                profit_hr: Number(rawData.profit_hr || 0),
                lvl: Number(rawData.lvl || 1)
            };

            // 4. Инициализация TON Connect SDK
            if (typeof TonConnectUI !== 'undefined') {
                this.tonConnectUI = new TonConnectUI.TonConnectUI({
                    manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
                    buttonRootId: 'ton-connect-btn' // ID контейнера для кнопки в модалке
                });
            }

            // 5. Запуск игровых циклов (доход, реген, автосейв)
            this.startLoops();
            
            // 6. Инициализация визуальной части (события кликов и т.д.)
            ui.init(); 
            
            return true; 
        } catch (e) {
            console.error("❌ Logic Error:", e);
            // В случае ошибки сервера всё равно инициализируем UI, чтобы экран не "висел"
            ui.init();
            return false;
        }
    },

    /**
     * Обработка клика (тапа) по центральному объекту
     */
    tap(e) {
        if (!this.user || this.user.energy < 1) return;

        // Прибавляем баланс согласно уровню клика
        this.user.balance += this.user.click_lvl;
        // Тратим 1 единицу энергии
        this.user.energy -= 1;
        
        // Динамический расчет уровня (например, +1 за каждые 10к монет)
        this.user.lvl = Math.floor(this.user.balance / 10000) + 1;
        
        // Обновляем цифры на экране и запускаем анимацию "+1"
        ui.update();
        ui.anim(e);
    },

    /**
     * Игровые циклы: доход в секунду и регенерация энергии
     */
    startLoops() {
        // Цикл обновления раз в секунду
        setInterval(() => {
            if (!this.user) return;
            
            // 1. Регенерация энергии (+1 в сек до максимума)
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1);
            }
            
            // 2. Начисление пассивного дохода (делим часовой профит на 3600 сек)
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            
            // Обновляем интерфейс
            ui.update();
        }, 1000);

        // Автоматическое сохранение в БД каждые 10 секунд
        setInterval(() => this.save(), 10000);
    },

    /**
     * Синхронизация прогресса игрока с сервером
     */
    async save() {
        if (!this.user) return;
        try {
            const payload = {
                userId: this.user.user_id,
                username: this.user.username,
                photo_url: this.user.photo_url,
                balance: this.user.balance,
                energy: Math.floor(this.user.energy),
                max_energy: this.user.max_energy,
                click_lvl: this.user.click_lvl,
                profit_hr: this.user.profit_hr,
                lvl: this.user.lvl
            };

            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                console.log("💾 Progress synced with server");
            }
        } catch (e) { 
            console.warn("📡 Sync lost: data stored locally for now"); 
        }
    }
};
