/**
 * ui.js — Визуальное обновление интерфейса
 */
const ui = {
    // Открытие модальных окон
    openM: (id) => {
        const modal = document.getElementById('m-' + id);
        if (modal) modal.style.display = 'flex';
        
        // Если открываем ТОП, вызываем загрузку данных
        if (id === 'top') logic.loadTop();
    },

    // Закрытие всех модальных окон
    closeM: () => {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    },

    // Главная функция отрисовки данных пользователя
    render: (s) => {
        // Баланс и имя
        if (document.getElementById('balance')) {
            document.getElementById('balance').innerText = Math.floor(s.bal).toLocaleString();
        }
        if (document.getElementById('u-name')) {
            document.getElementById('u-name').innerText = s.name;
        }

        // Уровень
        const lvlEl = document.getElementById('u-lvl');
        if (lvlEl) lvlEl.innerText = `LVL ${s.lvl}`;

        // Энергия (текст и полоска)
        const engVal = document.getElementById('eng-val');
        const engFill = document.getElementById('eng-fill');
        if (engVal) engVal.innerText = `${s.eng}/${s.maxEng}`;
        if (engFill) {
            const pct = (s.eng / s.maxEng) * 100;
            engFill.style.width = `${pct}%`;
        }

        // Аватар (загружаем один раз)
        const avaBox = document.getElementById('u-ava');
        if (avaBox && s.ava && avaBox.innerHTML === "") {
            avaBox.innerHTML = `<img src="${s.ava}" style="width:100%; height:100%; object-fit:cover;">`;
        }
    }
};

// Инициализация TON Connect (если кнопка есть в HTML)
const tonConnect = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
    buttonRootId: 'ton-connect-btn'
});
