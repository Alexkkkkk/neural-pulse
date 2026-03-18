const loading = {
    async init() {
        let p = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        // 1. Сначала один раз загружаем данные из БД
        if (window.logic) {
            await logic.syncWithDB(); 
        }

        // 2. Имитация полоски загрузки
        const itv = setInterval(() => {
            p += Math.floor(Math.random() * 15) + 5;
            if (p >= 100) {
                p = 100;
                clearInterval(itv);
                this.finish();
            }
            if(bar) bar.style.width = p + '%';
            if(pct) pct.innerText = p + '%';
        }, 80);
    },

    finish() {
        // Инициализируем только интерфейс и слушатели, данные уже есть
        ui.init();
        logic.startPassiveIncome();
        logic.setupListeners();
        
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.expand();
                window.Telegram.WebApp.ready();
            }
        }, 300);
    }
};

window.onload = () => loading.init();
