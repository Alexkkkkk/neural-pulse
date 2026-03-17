const loading = {
    init() {
        let p = 0;
        const pct = document.getElementById('load-pct');
        const bar = document.getElementById('load-bar');
        const circle = document.getElementById('l-circle');

        const iv = setInterval(() => {
            p += Math.floor(Math.random() * 4) + 2;
            if (p >= 100) {
                p = 100;
                clearInterval(iv);
                this.done(pct, bar, circle);
            }
            pct.innerText = `${p}%`;
            bar.style.width = `${p}%`;
        }, 50);
    },

    async done(pct, bar, circle) {
        pct.classList.add('complete');
        circle.classList.add('complete');
        
        // Пока идет анимация 100%, грузим данные
        await logic.loadData();
        ui.render();

        setTimeout(() => {
            const ls = document.getElementById('loading-screen');
            ls.style.opacity = '0';
            setTimeout(() => {
                ls.style.display = 'none';
                document.getElementById('app').style.display = 'flex';
            }, 500);
        }, 1000);
    }
};

window.onload = () => loading.init();
