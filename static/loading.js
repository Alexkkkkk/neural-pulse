const loading = {
    async init() {
        let p = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        const appVer = document.getElementById('app-ver'); // Элемент для версии
        
        try {
            // Ждем ответ от БД или заходим в оффлайн через 2 сек
            await Promise.race([
                (logic && logic.syncWithDB) ? logic.syncWithDB() : Promise.resolve(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
            ]);
            
            // Получаем версию с сервера
            const vRes = await fetch('/api/version');
            if (vRes.ok) {
                const vData = await vRes.json();
                if (appVer) appVer.innerText = vData.version;
            }

        } catch (e) {
            console.log("Offline mode active:", e.message);
        }

        // Имитация загрузки
        const itv = setInterval(() => {
            p += Math.floor(Math.random() * 15) + 10;
            if (p >= 100) {
                p = 100;
                clearInterval(itv);
                this.startApp();
            }
            if (bar) bar.style.width = p + '%';
            if (pct) pct.innerText = p + '%';
        }, 100);
    },

    startApp() {
        // Инициализируем UI
        if (window.ui) ui.init();
        
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            const appScreen = document.getElementById('app');
            
            // Переключаем экраны
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (appScreen) appScreen.style.display = 'flex';
            
            // Разворачиваем Telegram на весь экран
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.expand();
            }
        }, 300);
    }
};

// Запуск при полной загрузке страницы
window.onload = () => loading.init();
