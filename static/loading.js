const loading = {
    async init() {
        let p = 0;
        const bar = document.getElementById('load-bar');
        const pct = document.getElementById('load-pct');
        
        // Запускаем логику и ждем ответа от БД
        if (window.logic) {
            await logic.init(); 
        }

        const itv = setInterval(() => {
            p += Math.floor(Math.random() * 10) + 5;
            if (p >= 100) {
                p = 100;
                clearInterval(itv);
                this.finish();
            }
            if(bar) bar.style.width = p + '%';
            if(pct) pct.innerText = p + '%';
        }, 50);
    },

    finish() {
        ui.init();
        logic.startPassiveIncome();
        
        const ls = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (ls) ls.style.opacity = '0';
        setTimeout(() => {
            if (ls) ls.style.display = 'none';
            if (app) app.style.display = 'flex';
        }, 500);
    }
};

window.onload = () => loading.init();
