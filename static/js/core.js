const tg = window.Telegram.WebApp;
const socket = io();
tg.expand();

const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('u') || (tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : "guest");

let state = { score: 0, energy: 1000, max_energy: 1000, tap_power: 1, pnl: 0, level: 1 };

async function initGame() {
    try {
        const r = await fetch(`/api/balance/${uid}`);
        const res = await r.json();
        if(res.status === 'ok') state = res.data;
        updateUI();
    } catch(e) { console.error("API Error"); }
}

function updateUI() {
    document.getElementById('balance').innerText = Math.floor(state.score).toLocaleString();
    document.getElementById('energy-text').innerText = `${Math.floor(state.energy)}/${state.max_energy}`;
    document.getElementById('energy-fill').style.width = `${(state.energy / state.max_energy) * 100}%`;
    document.getElementById('pnl-info').innerText = `PROFIT: +${state.pnl}/HR`;
    document.getElementById('lvl-badge').innerText = state.level;
}

// Твоя механика тапа
document.getElementById('tap-zone').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state.energy < state.tap_power) {
        tg.HapticFeedback.notificationOccurred('error');
        return;
    }

    for(let i=0; i < e.touches.length; i++) {
        state.score += state.tap_power;
        state.energy -= state.tap_power;
        
        // Отправка на сервер через сокет
        socket.emit('tap', { uid: uid });

        // Визуальный эффект (Текст +1)
        createTapText(e.touches[i].pageX, e.touches[i].pageY);
    }
    
    updateUI();
    tg.HapticFeedback.impactOccurred('light');
    animateLogo();
});

function createTapText(x, y) {
    const num = document.createElement('div');
    num.className = 'tap-text';
    num.innerText = `+${state.tap_power}`;
    num.style.left = `${x}px`;
    num.style.top = `${y}px`;
    document.body.appendChild(num);
    setTimeout(() => num.remove(), 700);
}

function animateLogo() {
    const logo = document.getElementById('main-logo');
    logo.style.transform = 'scale(0.95)';
    setTimeout(() => logo.style.transform = 'scale(1)', 50);
}

document.getElementById('invite-btn').onclick = () => {
    const link = `https://t.me/neural_pulse_bot?start=${uid}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=Join my Neural Network!`);
};

// Твой доход в секунду
setInterval(() => {
    state.score += (state.pnl / 3600);
    if (state.energy < state.max_energy) state.energy = Math.min(state.max_energy, state.energy + 1.2);
    updateUI();
}, 1000);

initGame();
