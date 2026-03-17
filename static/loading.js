const loading = {
    async init() {
        let p = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        const appVer = document.getElementById('app-ver');
        
        try {
            // Ждем синхронизацию (как в 3.6.0)
            await Promise.race([
                logic.syncWithDB(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
            ]);
            
            const vRes = await fetch('/api/version');
            if (vRes.ok) {
                const vData = await vRes.json();
                if (appVer) appVer.innerText = vData.version;
            }
        } catch (e) {
            console.log("Offline mode active");
        }

        // Плавная анимация загрузки
        const itv = setInterval(() => {
            p += Math.floor(Math.random() * 10) + 5;
            if (p >= 100) {
                p = 100;
                clearInterval(itv);
                this.startApp();
            }
            if (bar) bar.style.width = p + '%';
            if (pct) pct.innerText = p + '%';
        }, 80);
    },

    startApp() {
        ui.init();
        logic.startLoop(); // Запускаем тики дохода и регена
        
        setTimeout(() => {
            const ls = document.getElementById('loading-screen');
            const app = document.getElementById('app');
            if (ls) ls.style.display = 'none';
            if (app) app.style.display = 'flex';
            
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.expand();
            }
        }, 300);
    }
};

window.onload = () => loading.init();
