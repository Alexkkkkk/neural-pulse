const loading = {
    progress: 0,
    isLogicReady: false,

    async init() {
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        // Запускаем загрузку данных
        this.startLogic();

        const interval = setInterval(() => {
            if (this.progress < 90) {
                this.progress += Math.random() * 3;
            } else if (this.isLogicReady) {
                this.progress += 2;
            }

            if (this.progress > 100) this.progress = 100;

            if (bar) bar.style.width = this.progress + '%';
            if (pct) pct.innerText = Math.floor(this.progress) + '%';

            if (this.progress >= 100 && this.isLogicReady) {
                clearInterval(interval);
                this.finish();
            }
        }, 50). 
    },

    async startLogic() {
        if (window.logic) {
            const success = await logic.init();
            if (success) {
                this.isLogicReady = true;
                console.log("✅ Logic Ready");
            }
        }
    },

    finish() {
        if (window.ui) ui.init();
        
        const ls = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (ls) ls.style.opacity = '0';
        setTimeout(() => {
            if (ls) ls.style.display = 'none';
            if (app) app.style.display = 'flex';
        }, 500);
    }
};

window.addEventListener('load', () => loading.init());
