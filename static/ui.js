const ui = {
            init() { 
                this.update(); 
                this.finishLoading(); 
            },
            update() {
                if (!logic || !logic.user) return;
                try {
                    document.getElementById('balance').innerText = Math.floor(logic.user.balance).toLocaleString();
                    document.getElementById('eng-val').innerText = `${Math.floor(logic.user.energy)}/${logic.user.max_energy}`;
                    document.getElementById('eng-fill').style.width = `${(logic.user.energy / logic.user.max_energy) * 100}%`;
                    document.getElementById('u-lvl').innerText = `LVL ${logic.user.lvl}`;
                    document.getElementById('u-name').innerText = logic.user.username;
                    document.getElementById('tap-val').innerText = `+${logic.user.click_lvl}`;
                    document.getElementById('profit-val').innerText = Math.floor(logic.user.profit_hr).toLocaleString();
                    
                    const avatar = document.getElementById('u-avatar');
                    if (logic.user.photo_url && logic.user.photo_url !== "") {
                        avatar.src = logic.user.photo_url;
                    }
                } catch (err) {
                    console.error("UI Update error:", err);
                }
            },
            openM(type) {
                const body = document.getElementById('modal-body');
                const header = document.getElementById('modal-header');
                header.innerText = type.toUpperCase();
                let html = '';
                
                if (type === 'wallet') {
                    const addr = logic.user?.wallet;
                    html = `
                        <div style="text-align:center;">
                            <div id="ton-connect-button" style="display:flex; justify-content:center; margin-bottom:15px;"></div>
                            <p style="color:#00ffff; font-family:monospace; font-size:12px; word-break:break-all; padding:0 10px;">
                                ${addr ? addr : "Not Connected"}
                            </p>
                            ${addr ? `<button onclick="logic.disconnectWallet()" class="back-btn" style="background:rgba(255,0,0,0.2); color:red; margin-top:15px; border:1px solid red; width:80%;">DISCONNECT</button>` : ''}
                        </div>`;
                    body.innerHTML = html;
                    setTimeout(() => {
                        tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-button' };
                    }, 100);

                } else if (type === 'boost') {
                    html = `
                        <div class="up-card" onclick="logic.buyUpgrade('tap')">
                            <div class="up-info"><b>Multi-Tap</b><br><small>+1 point per tap</small></div>
                            <div class="up-price">💰 5,000</div>
                        </div>
                        <div class="up-card" onclick="logic.buyUpgrade('energy')">
                            <div class="up-info"><b>Energy Limit</b><br><small>+500 max capacity</small></div>
                            <div class="up-price">💰 10,000</div>
                        </div>`;
                    body.innerHTML = html;

                } else if (type === 'mine') {
                    html = `
                        <div class="up-card" onclick="logic.buyUpgrade('profit')">
                            <div class="up-info"><b>Neural Core</b><br><small>+500 profit per hour</small></div>
                            <div class="up-price">💰 25,000</div>
                        </div>`;
                    body.innerHTML = html;

                } else if (type === 'top') {
                    body.innerHTML = '<p style="text-align:center;">ACCESSING RANKINGS...</p>';
                    fetch('/api/top').then(r => r.json()).then(data => {
                        let list = '';
                        data.forEach((u, i) => {
                            list += `<div class="up-card">#${i+1} ${u.username} <b>${Math.floor(u.balance)}</b></div>`;
                        });
                        body.innerHTML = list;
                    }).catch(() => { body.innerHTML = '<p>Error loading top.</p>'; });

                } else {
                    body.innerHTML = `<p style="text-align:center; padding:20px; color:#888;">Module ${type} is coming soon.</p>`;
                }
                document.getElementById('modal-container').classList.add('active');
            },
            closeM() { 
                document.getElementById('modal-container').classList.remove('active'); 
            },
            finishLoading() {
                let p = 0;
                const bar = document.getElementById('load-bar');
                const pct = document.getElementById('load-pct');
                const iv = setInterval(() => {
                    p += 5;
                    if (pct) pct.innerText = p + '%';
                    if (bar) bar.style.width = p + '%';
                    if (p >= 100) {
                        clearInterval(iv);
                        setTimeout(() => {
                            document.getElementById('loading-screen').style.opacity = '0';
                            setTimeout(() => {
                                document.getElementById('loading-screen').style.display = 'none';
                                document.getElementById('app').style.display = 'flex';
                            }, 500);
                        }, 200);
                    }
                }, 30);
            }
        };
