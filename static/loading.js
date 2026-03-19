window.onload = async () => {
    const bar = document.getElementById('load-bar');
    const pct = document.getElementById('load-pct');
    let p = 0;

    const interval = setInterval(async () => {
        p += Math.random() * 15;
        if (p >= 100) {
            p = 100;
            clearInterval(interval);
            
            const success = await logic.init();
            if (success) {
                ui.init();
                document.getElementById('loading-screen').style.display = 'none';
                document.getElementById('app').style.display = 'flex';
            } else {
                document.querySelector('.loading-text').innerText = "DB ERROR: CHECK SERVER";
                document.querySelector('.loading-text').style.color = "red";
            }
        }
        bar.style.width = p + '%';
        pct.innerText = Math.floor(p) + '%';
    }, 100);
};
