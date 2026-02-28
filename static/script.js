let tg = window.Telegram.WebApp;
tg.expand();

let score = 0, clickLvl = 1, botLvl = 0, leagueId = 1;
const userId = tg.initDataUnsafe?.user?.id || 123;
const LEAGUE_TARGETS = [600000, 900000, 1400000, 2100000, 3000000, 4100000, 5400000, 6900000, 8600000, 10500000, 12600000, 14900000, 17400000, 20100000, 23000000, 26100000, 29400000, 32900000, 36600000, 40500000];
const LEAGUE_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster", "Elite", "Legend", "Mythic", "Titan", "Immortal", "Ether", "Void", "Solar", "Galactic", "Universal", "Cosmic", "Divine", "Neural God"];

async function load() {
    const res = await fetch(`/api/balance/${userId}`);
    const d = await res.json();
    score = d.balance + (d.offline_profit || 0);
    clickLvl = d.click_lvl; botLvl = d.bot_lvl; leagueId = d.league_id || 1;
    if(d.offline_profit > 0) tg.showAlert(`Боты добыли: ${d.offline_profit} 💎`);
    update();
}

function update() {
    document.getElementById('score').innerText = Math.floor(score).toLocaleString();
    document.getElementById('league-name').innerText = LEAGUE_NAMES[leagueId-1];
    document.getElementById('buy-click').innerText = `Tap Lvl ${clickLvl} (${clickLvl * 500})`;
    document.getElementById('buy-bot').innerText = `Bot Lvl ${botLvl} (${(botLvl + 1) * 1500})`;
    
    let prev = leagueId === 1 ? 0 : LEAGUE_TARGETS[leagueId-2];
    let prog = ((score - prev) / (LEAGUE_TARGETS[leagueId-1] - prev)) * 100;
    document.getElementById('progress-fill').style.width = `${Math.min(100, prog)}%`;
    document.getElementById('progress-percent').innerText = `${Math.floor(Math.min(100, prog))}%`;
}

document.getElementById('click-btn').onclick = (e) => {
    score += clickLvl; tg.HapticFeedback.impactOccurred('medium');
    if (score >= LEAGUE_TARGETS[leagueId-1] && leagueId < 20) { leagueId++; tg.showAlert("New League!"); }
    update();
    const p = document.createElement('div'); p.innerText = `+${clickLvl}`; p.className = 'particle';
    p.style.left = `${e.clientX}px`; p.style.top = `${e.clientY}px`;
    document.body.appendChild(p); setTimeout(() => p.remove(), 800);
};

document.getElementById('buy-click').onclick = () => {
    let cost = clickLvl * 500; if(score >= cost) { score -= cost; clickLvl++; update(); save(); }
};

document.getElementById('buy-bot').onclick = () => {
    let cost = (botLvl + 1) * 1500; if(score >= cost) { score -= cost; botLvl++; update(); save(); }
};

async function save() {
    const res = await fetch('/api/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user_id: userId, score: Math.floor(score), league_id: leagueId, click_lvl: clickLvl, bot_lvl: botLvl})
    });
    const d = await res.json();
    document.getElementById('jackpot-value').innerText = d.global_jackpot;
}

setInterval(save, 15000);
load();
