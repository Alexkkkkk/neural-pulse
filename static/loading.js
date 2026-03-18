const loading = {
    progress: 0,
    isLogicReady: false,

    async init() {
        console.log("⏳ Loading started...");
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        // 1. Запускаем инициализацию логики в фоновом режиме
        this.startLogic();

        // 2. Запускаем визуальную полоску загрузки
        const interval = setInterval(() => {
            // Если логика еще не готова, замедляем прогресс на 90%
            if (this.progress < 90) {
                this.progress += Math.floor(Math.random() * 5) + 2;
            } else if (this.isLogicReady) {
                // Если данные из БД пришли, добиваем до 100%
                this.progress += 10;
            }

            if (this.progress > 100) this.progress = 100;

            if (bar) bar.style.width = this.progress + '%';
            if (pct) pct.innerText = Math.floor(this.progress) + '%';

            // Проверка завершения
            if (this.progress >= 100 && this.isLogicReady) {
                clearInterval(interval);
                this.finish();
            }
        }, 100);
    },

    async startLogic() {
        try {
            if (window.logic) {
                await logic.init();
            }
            this.isLogicReady = true;
            console.log("✅ Logic is ready");
        } catch (err) {
            console.error("❌ Logic init failed:", err);
            this.isLogicReady = true; 
        }
    },

    finish() {
        console.log("🚀 Finishing loading...");
        
        if (window.ui) ui.init();
        if (window.logic) logic.startPassiveIncome();
        
        const ls = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (ls) {
            ls.style.transition = 'opacity 0.5s ease';
            ls.style.opacity = '0';
        }

        setTimeout(() => {
            if (ls) ls.style.display = 'none';
            if (app) {
                app.style.display = 'flex';
                app.style.animation = 'fadeIn 0.5s ease';
            }
        }, 500);
    }
};

window.addEventListener('load', () => loading.init());
