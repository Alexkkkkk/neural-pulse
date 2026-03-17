const loading = {
    async init() {
        let p = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        try {
            // Ждем синхронизацию из logic (макс 2 сек)
            await Promise.race([
                logic.syncWithDB(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
            ]);
            
            // Пытаемся получить версию
            const vRes = await fetch('/api/version');
            if (vRes.ok) {
                const vData = await vRes.json();
                // Обновляем версию в UI, если элемент существует
                const verTag = document.querySelector('.u-info small');
                if (verTag) verTag.innerText = vData.version;
            }
        } catch (e) {
            console.log("Proceeding in offline mode");
        }

        // Анимация полоски загрузки
        const itv = setInterval(() => {
            p += Math.floor(Math.random() * 12) + 8;
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
        ui.init();
        logic.startLoop(); // Запускаем пассивный доход и реген
        
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
