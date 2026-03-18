const ui = {
    // Инициализация интерфейса
    init() {
        console.log("🖥️ Интерфейс инициализирован");
        this.update(); // Сразу отрисовываем текущие данные
    },

    // Обновление всех данных на экране
    update() {
        if (typeof logic === 'undefined') return;

        // 1. Баланс (с разделением тысяч для красоты: 1 000 000)
        const bld = document.getElementById('balance');
        if (bld) {
            bld.innerText = Math.floor(logic.user.balance).toLocaleString();
        }

        // 2. Энергия
        const engV = document.getElementById('eng-val');
        const engF = document.getElementById('eng-fill');
        if (engV && engF) {
            const currentEng = Math.floor(logic.user.energy);
            const maxEng = logic.user.max_energy;
            engV.innerText = `${currentEng}/${maxEng}`;
            
            // Расчет ширины полоски в %
            const percent = (currentEng / maxEng) * 100;
            engF.style.width = percent + "%";
        }

        // 3. Статистика (Сила клика и Прибыль в час)
        const tapV = document.getElementById('tap-val');
        if (tapV) tapV.innerText = "+" + logic.user.click_lvl;

        const profV = document.getElementById('profit-val');
        if (profV) profV.innerText = Math.floor(logic.user.profit).toLocaleString();
        
        // 4. Уровень пользователя
        const lvlV = document.getElementById('u-lvl');
        if (lvlV) lvlV.innerText = `LVL ${logic.user.level}`;
    },

    // Открытие модальных окон
    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        let content = "";
        
        // Рендерим контент в зависимости от выбранной вкладки
        if (id === 'boost') {
            content = `
                <div class="modal-header">BOOSTERS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                    <div class="upg-info">
                        <small>UPGRADE TAP (LVL ${logic.user.click_lvl})</small>
                        <p>Увеличивает доход за один клик на +1</p>
                    </div>
                    <div class="upg-price">💰 1 000</div>
                </div>
                <div class="upgrade-card" onclick="ui.handleBuy('energy', 5000, 500)">
                    <div class="upg-info">
                        <small>MAX ENERGY</small>
                        <p>Добавляет +500 к лимиту энергии</p>
                    </div>
                    <div class="upg-price">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK TO MINING</button>
            `;
        } else if (id === 'mine') {
            content = `
                <div class="modal-header">MINING RIGS</div>
                <div class="upgrade-card" onclick="ui.handleBuy('profit', 5000, 100)">
                    <div class="upg-info">
                        <small>NEURAL CHIP v1</small>
                        <p>Дает пассивный доход +100/час</p>
                    </div>
                    <div class="upg-price" style="color: #00f2ff;">💰 5 000</div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK TO MINING</button>
            `;
        } else {
            // Заглушка для остальных окон (Tasks, Wallet и т.д.)
            content = `
                <div class="modal-header">${id.toUpperCase()}</div>
                <div style="padding: 40px; text-align: center; color: #888;">
                    Модуль в разработке... <br> Скоро здесь появится новый функционал.
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }

        const modalContent = m.querySelector('.modal-content');
        if (modalContent) {
            modalContent.innerHTML = content;
        }
        m.classList.add('active');
    },

    // Закрытие всех окон
    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    // Обработка покупки
    async handleBuy(type, cost, val) {
        if (typeof logic === 'undefined') return;

        const success = await logic.buyUpgrade(type, cost, val);
        if (success) {
            // Виброотклик Telegram при успешной покупке
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            // Перерисовываем окно, чтобы обновить уровни и цены
            this.openM(type === 'profit' ? 'mine' : 'boost'); 
        } else {
            // Виброотклик ошибки
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
            alert("Недостаточно Neural Pulse!");
        }
    },

    // Анимация вылетающих цифр при клике
    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-anim';
        n.innerText = `+${logic.user.click_lvl}`;
        
        // Позиция клика
        n.style.left = e.pageX + "px";
        n.style.top = e.pageY + "px";
        
        document.body.appendChild(n);
        
        // Удаляем элемент после завершения анимации
        setTimeout(() => {
            n.remove();
        }, 800);
    }
};
