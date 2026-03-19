window.onload = async () => {
    const bar = document.getElementById('load-bar');
    const pct = document.getElementById('load-pct');
    let progress = 0;

    const interval = setInterval(async () => {
        progress += Math.random() * 15;
        
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            
            // Пытаемся загрузить данные
            const success = await logic.init();
            
            if (success) {
                ui.init();
                document.getElementById('loading-screen').style.display = 'none';
                document.getElementById('app').style.display = 'flex';
            } else {
                const text = document.querySelector('.loading-text');
                if (text) {
                    text.innerText = "SERVER ERROR. TRY LATER";
                    text.style.color = "#ff4444";
                }
            }
        }
        
        if (bar) bar.style.width = progress + '%';
        if (pct) pct.innerText = Math.floor(progress) + '%';
    }, 100);
};
