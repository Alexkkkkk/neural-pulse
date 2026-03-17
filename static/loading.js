const loading = {
    async init() {
        let p = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        try {
            // Ждем ответ от БД или заходим в оффлайн через 2 сек
            await Promise.race([
                logic.syncWithDB(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
            ]);
            
            // Получаем версию с сервера
            const vRes = await fetch('/api/version');
            const vData = await vRes.json();
            document.getElementById('app-ver').innerText = vData.version;

        } catch (e) {
            console.log("Offline mode active");
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
        }, 100);
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
