const loading = {
    async init() {
        let p = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        // 1. Сначала синхронизируемся с БД (из main.py)
        if (window.logic) {
            await logic.syncWithDB(); 
        }

        // 2. Запускаем имитацию полоски загрузки
        const itv = setInterval(() => {
            p += Math.floor(Math.random() * 15) + 10;
            if (p >= 100) {
                p = 100;
                clearInterval(itv);
                this.finish();
            }
            if(bar) bar.style.width = p + '%';
            if(pct) pct.innerText = p + '%';
        }, 120);
    },

    // 3. Запуск основного приложения
    finish() {
        ui.init();
        logic.init();
        
        setTimeout(() => {
            // Переключаем экраны
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            
            // Разворачиваем Telegram на весь экран
            if (window.Telegram?.WebApp) window.Telegram.WebApp.expand();
        }, 300);
    }
};

// Запуск при загрузке страницы
window.onload = () => loading.init();
