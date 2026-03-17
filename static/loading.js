const loading = {
    async init() {
        let progress = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        // Фоновая синхронизация во время анимации загрузки
        logic.syncWithDB();

        const itv = setInterval(() => {
            progress += Math.floor(Math.random() * 15) + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(itv);
                this.finish();
            }
            if (bar) bar.style.width = progress + '%';
            if (pct) pct.innerText = progress + '%';
        }, 120);
    },

    finish() {
        ui.init();
        logic.startIntervals();
        
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
