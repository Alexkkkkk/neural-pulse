const loading = {
    async init() {
        let p = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        try {
            // Ждем ответ от БД максимум 2 секунды, чтобы не зависнуть
            await Promise.race([
                logic.syncWithDB(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Таймаут БД")), 2000))
            ]);
        } catch (e) {
            console.log("БД не ответила вовремя, загружаемся в оффлайн-режиме");
        }

        const itv = setInterval(() => {
            p += Math.floor(Math.random() * 15) + 10;
            if (p >= 100) {
                p = 100;
                clearInterval(itv);
                this.startApp();
            }
            if(bar) bar.style.width = p + '%';
            if(pct) pct.innerText = p + '%';
        }, 150);
    },

    startApp() {
        ui.init();
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            if (window.Telegram?.WebApp) window.Telegram.WebApp.expand();
        }, 300);
    }
};

window.onload = () => loading.init();
