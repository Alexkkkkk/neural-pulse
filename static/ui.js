const ui = {
    init() {
        console.log("🖥️ [UI] Инициализация");
        const firstNav = document.querySelector('.bottom-nav .nav-btn');
        if (firstNav) firstNav.classList.add('active');
        this.update();
    },

    update() {
        if (typeof logic === 'undefined' || !logic.user) return;
        try {
            document.getElementById('balance').innerText = Math.floor(logic.user.balance).toLocaleString('ru-RU');
            document.getElementById('tap-val').innerText = "+" + logic.user.click_lvl;
            document.getElementById('profit-val').innerText = Math.floor(logic.user.profit_hr).toLocaleString('ru-RU');
            document.getElementById('u-lvl').innerText = `LVL ${logic.user.lvl}`;
            
            const currentEng = Math.floor(logic.user.energy);
            const maxEng = logic.user.max_energy;
            document.getElementById('eng-val').innerText = `${currentEng}/${maxEng}`;
            document.getElementById('eng-fill').style.width = (currentEng / maxEng * 100) + "%";
        } catch (e) { console.error("UI Update error", e); }
    },

    openM(id) {
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => btn.classList.remove('active'));
        if (window.event && window.event.currentTarget?.classList.contains('nav-btn')) {
            window.event.currentTarget.classList.add('active');
        }

        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        let content = "";
        
        switch(id) {
            case 'top':
                content = `
                    <div class="modal-header">GLOBAL LEADERS</div>
                    <div class="upgrade-card" style="border: 1px solid var(--accent)">
                        <b>1. ${logic.user.username} (You)</b>
                        <span>${Math.floor(logic.user.balance).toLocaleString()} 💰</span>
                    </div>
                    <div class="upgrade-card"><span>2. Neural_Bot</span> <span>500,000 💰</span></div>
                    <div class="upgrade-card"><span>3. Satoshi_N</span> <span>250,000 💰</span></div>
                `;
                break;
            case 'wallet':
                content = `
                    <div class="modal-header">CRYPTO WALLET</div>
                    <div style="text-align:center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 10px;">💎</div>
                        <p>Connect your TON wallet to withdraw rewards.</p>
                        <button class="back-btn" style="background:var(--accent); color:#000; width:100%; margin-top:15px;">CONNECT TON</button>
                    </div>
                `;
                break;
            case 'boost':
                content = `
                    <div class="modal-header">UPGRADES</div>
                    <div class="upgrade-card" onclick="ui.handleBuy('tap', 1000, 1)">
                        <div><b>Multi-Tap</b><br><small>+1 per tap</small></div>
                        <div class="upg-price">💰 1,000</div>
                    </div>
                    <div class="upgrade-card" onclick="ui.handleBuy('energy', 5000, 500)">
                        <div><b>Energy Limit</b><br><small>+500 capacity</small></div>
                        <div class="upg-price">💰 5,000</div>
                    </div>
                `;
                break;
            default:
                content = `<div class="modal-header">${id.toUpperCase()}</div><p style="text-align:center; opacity:0.5;">System expansion in progress...</p>`;
        }

        content += `<button class="back-btn" onclick="ui.closeM()">CLOSE</button>`;
        m.querySelector('.modal-content').innerHTML = content;
        m.classList.add('active');
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    async handleBuy(type, cost, val) {
        const success = await logic.buyUpgrade(type, cost, val);
        if (success) {
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            this.openM('boost');
        } else {
            alert("Insufficient Pulse!");
        }
    },

    anim(e) {
        const n = document.createElement('div');
        n.className = 'tap-pop';
        n.innerText = `+${logic.user.click_lvl}`;
        const x = e.clientX || (e.touches ? e.touches[0].clientX : window.innerWidth/2);
        const y = e.clientY || (e.touches ? e.touches[0].clientY : window.innerHeight/2);
        n.style.left = `${x}px`;
        n.style.top = `${y}px`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 800);
    }
};
