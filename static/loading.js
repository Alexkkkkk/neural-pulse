/**
 * loading.js — Логика прелоадера
 */
const loading = {
    init() {
        let progress = 0;
        const pctEl = document.getElementById('load-pct');
        const barEl = document.getElementById('load-bar');
        const circEl = document.getElementById('l-circle');

        const interval = setInterval(() => {
            // Имитация загрузки случайными шагами
            progress += Math.floor(Math.random() * 6) + 2;

            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                
                // Эффекты при достижении 100%
                pctEl.innerText = "100%";
                pctEl.classList.add('complete'); // Меняет цвет текста в CSS
                circEl.classList.add('complete'); // Меняет цвет круга в CSS
                barEl.style.width = "100%";

                // Плавный переход в игру
                setTimeout(() => {
                    const screen = document.getElementById('loading-screen');
                    screen.style.opacity = '0';
                    
                    setTimeout(() => {
                        screen.style.display = 'none';
                        document.getElementById('app').style.display = 'flex';
                        
                        // Запускаем основную логику игры
                        if (typeof logic !== 'undefined') {
                            logic.start();
                        }
                    }, 500);
                }, 1100); // Даем время насладиться соткой
            } else {
                pctEl.innerText = progress + "%";
                barEl.style.width = progress + "%";
            }
        }, 60);
    }
};

// Запуск при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    loading.init();
});
