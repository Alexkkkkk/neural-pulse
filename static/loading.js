(function() {
    let progress = 0;
    const loadPct = document.getElementById('load-pct');
    const loadBar = document.getElementById('load-bar');
    const screen = document.getElementById('loading-screen');
    const app = document.getElementById('app');

    const interval = setInterval(async () => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            
            const success = await logic.init();
            if (success) {
                screen.style.opacity = '0';
                screen.style.transition = '0.5s';
                setTimeout(() => {
                    screen.style.display = 'none';
                    app.style.display = 'flex';
                }, 500);
            }
        }
        loadPct.innerText = `${Math.floor(progress)}%`;
        loadBar.style.width = `${progress}%`;
    }, 150);
})();
