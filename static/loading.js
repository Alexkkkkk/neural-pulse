const loading = {
    init() {
        let p = 0;
        const pctEl = document.getElementById('load-pct');
        const barEl = document.getElementById('load-bar');
        const circEl = document.getElementById('l-circle');

        const interval = setInterval(() => {
            p += Math.floor(Math.random() * 5) + 2;
            if (p >= 100) {
                p = 100;
                clearInterval(interval);
                
                // Визуальное завершение
                pctEl.innerText = "100%";
                pctEl.classList.add('complete');
                circEl.classList.add('complete');
                barEl.style.width = "100%";

                setTimeout(() => {
                    document.getElementById('loading-screen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('loading-screen').style.display = 'none';
                        document.getElementById('app').style.display = 'flex';
                        logic.start(); 
                    }, 500);
                }, 1000);
            } else {
                pctEl.innerText = p + "%";
                barEl.style.width = p + "%";
            }
        }, 50);
    }
};
loading.init();
