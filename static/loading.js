const loading = {
    async init() {
        let p = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        // Получаем данные юзера с сервера
        await logic.syncWithDB();

        const itv = setInterval(() => {
            p += Math.floor(Math.random() * 10) + 5;
            if (p >= 100) {
                p = 100;
                clearInterval(itv);
                this.startApp();
            }
            bar.style.width = p + '%';
            pct.innerText = p + '%';
        }, 100);
    },

    startApp() {
        // Запускаем UI
        ui.init();
        
        // Прячем загрузку, показываем приложение
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            document.getElementById('app').style.flexDirection = 'column';
            document.getElementById('app').style.height = '100vh';
            
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.expand();
            }
        }, 300);
    }
};

// Самый первый скрипт, который срабатывает при открытии страницы
window.onload = () => loading.init();
