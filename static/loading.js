const loader = {
    init() {
        let p = 0;
        const interval = setInterval(() => {
            p += Math.floor(Math.random() * 3) + 1;
            if (p >= 99) {
                p = 99;
                clearInterval(interval);
                setTimeout(() => {
                    document.getElementById('loading-screen').style.display = 'none';
                    document.getElementById('app').style.display = 'flex';
                    logic.init(); 
                }, 800);
            }
            document.getElementById('load-pct').innerText = p + '%';
            document.getElementById('load-bar').style.width = p + '%';
        }, 40);
    }
};
loader.init();
