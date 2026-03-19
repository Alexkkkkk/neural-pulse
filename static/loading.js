/**
 * Neural Pulse - Система управления загрузкой
 */
window.onload = async () => {
    const bar = document.getElementById('load-bar');
    const pct = document.getElementById('load-pct');
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    const loadingText = document.querySelector('.loading-text');
    
    let progress = 0;

    // Интервал обновления прогресс-бара
    const interval = setInterval(async () => {
        // Случайный прирост для эффекта живой загрузки
        progress += Math.random() * 15;
        
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            
            // Финальное обновление UI перед инициализацией
            if (bar) bar.style.width = '100%';
            if (pct) pct.innerText = '100%';

            try {
                // Пытаемся загрузить данные пользователя из logic.js
                // Ожидаем завершения logic.init()
                const success = await logic.init();
                
                if (success) {
                    // Инициализируем обработчики интерфейса
                    ui.init();
                    
                    // Плавный переход (Fade-out эффект)
                    loadingScreen.style.opacity = '0';
                    loadingScreen.style.transition = 'opacity 0.5s ease';
                    
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                        app.style.display = 'flex';
                        console.log("🚀 Neural Pulse: Access Granted");
                    }, 500);
                    
                } else {
                    // Обработка ошибки сервера
                    throw new Error("API_ERROR");
                }
            } catch (error) {
                console.error("Initialization failed:", error);
                if (loadingText) {
                    loadingText.innerText = "SERVER ERROR. TRY LATER";
                    loadingText.style.color = "#ff4444";
                    loadingText.style.textShadow = "0 0 10px #ff0000";
                }
                if (bar) bar.style.background = "#ff4444";
            }
            return;
        }
        
        // Обновление прогресс-бара во время движения
        if (bar) bar.style.width = progress + '%';
        if (pct) pct.innerText = Math.floor(progress) + '%';
    }, 100);
};
