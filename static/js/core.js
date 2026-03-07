
const socket = io();
const tg = window.Telegram.WebApp;
const uid = new URLSearchParams(window.location.search).get('u') || "guest";
let state = { bal: 0, en: 1000, m_en: 1000, pow: 1, pnl: 0 };

async function init() {
    const r = await fetch(`/api/init/${uid}`);
    const data = await r.json();
    state = data;
    updateUI();
}

function updateUI() {
    document.getElementById('balance').innerText = Math.floor(state.bal).toLocaleString();
    document.getElementById('energy-text').innerText = `${Math.floor(state.en)}/${state.m_en}`;
    document.getElementById('energy-fill').style.width = `${(state.en / state.m_en) * 100}%`;
}

document.getElementById('tap-zone').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state.en >= state.pow) {
        state.bal += state.pow;
        state.en -= state.pow;
        updateUI();
        
        const touch = e.touches[0];
        socket.emit('tap', { uid, x: touch.pageX, y: touch.pageY });
        createEffect(touch.pageX, touch.pageY);
        tg.HapticFeedback.impactOccurred('light');
    }
});

function createEffect(x, y) {
    const el = document.createElement('div');
    el.className = 'tap-text';
    el.innerText = `+${state.pow}`;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
}

init();
// Доход и регенерация
setInterval(() => {
    state.bal += (state.pnl / 3600);
    if (state.en < state.m_en) state.en = Math.min(state.m_en, state.en + 1.5);
    updateUI();
}, 1000);
