const ui = {
    init() {
        const target = document.getElementById('tap-target');
        target.addEventListener('touchstart', (e) => { e.preventDefault(); logic.tap(e); });
        this.update();
    },

    update() {
        if (!logic.user) return;
        const u = logic.user;
        document.getElementById('balance').innerText = Math.floor(u.balance).toLocaleString();
        document.getElementById('u-lvl').innerText = `LVL ${u.lvl}`;
        document.getElementById('eng-val').innerText = `${Math.floor(u.energy)}/${u.max_energy}`;
        document.getElementById('profit-val').innerText = u.profit_hr;
        document.getElementById('tap-val').innerText = `+${u.click_lvl}`;
        document.getElementById('eng-fill').style.width = `${(u.energy / u.max_energy) * 100}%`;
    },

    openM(id) {
        const m = document.getElementById('m-' + id);
        m.classList.add('active');
        m.querySelector('.modal-content').innerHTML = `
            <h2 style="color:var(--accent-cyan); text-align:center;">${id.toUpperCase()}</h2>
            <p style="text-align:center; opacity:0.6;">System Access in progress...</p>
            <button onclick="ui.closeM()" style="width:100%; padding:15px; background:#111; border:1px solid var(--border-color); color:white; border-radius:15px; margin-top:20px;">BACK</button>
        `;
    },

    closeM() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }
};
