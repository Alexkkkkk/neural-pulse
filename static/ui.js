const ui = {
    // ... (остальные методы без изменений)

    openM(id) {
        const m = document.getElementById('m-' + id);
        if (!m) return;
        
        m.classList.add('active');
        const container = m.querySelector('.modal-content');

        if (id === 'wallet') {
            container.innerHTML = `
                <div class="modal-header">TON WALLET</div>
                <div style="padding:20px; text-align:center;">
                    <div id="ton-connect-btn" style="display:inline-block;"></div>
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
            if (logic.tonConnectUI) {
                logic.tonConnectUI.uiOptions = { buttonRootId: 'ton-connect-btn' };
            }
        } 
        else if (id === 'mine') {
            // Список апгрейдов. В будущем это можно получать с сервера.
            const upgrades = [
                { id: 'cpu', name: 'Neural CPU', price: 500, profit: 100, icon: '🧠' },
                { id: 'gpu', name: 'GPU Cluster', price: 2500, profit: 550, icon: '⚡' },
                { id: 'server', name: 'Data Center', price: 10000, profit: 2500, icon: '🏢' }
            ];

            let listHtml = upgrades.map(upg => `
                <div class="upgrade-card" onclick="ui.buyUpgrade('${upg.id}', ${upg.price}, ${upg.profit})">
                    <div style="font-size:24px;">${upg.icon}</div>
                    <div style="flex-grow:1; margin-left:15px;">
                        <div style="font-weight:bold;">${upg.name}</div>
                        <small style="color:#00ff88;">+${upg.profit}/hr</small>
                    </div>
                    <div class="price-tag">💰 ${upg.price}</div>
                </div>
            `).join('');

            container.innerHTML = `
                <div class="modal-header">NEURAL MINING</div>
                <div style="padding:15px; display:flex; flex-direction:column; gap:10px;">
                    ${listHtml}
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
        else {
            container.innerHTML = `
                <div class="modal-header">${id.toUpperCase()}</div>
                <div style="text-align:center; padding:40px; opacity:0.5;">
                    <div style="font-size:40px; margin-bottom:10px;">🔒</div>
                    COMING SOON
                </div>
                <button class="back-btn" onclick="ui.closeM()">BACK</button>
            `;
        }
    },

    buyUpgrade(id, price, profit) {
        if (logic.user.balance >= price) {
            logic.user.balance -= price;
            logic.user.profit_hr += profit;
            this.update();
            // Показываем уведомление (опционально)
            alert('Улучшение куплено!');
            logic.save(); // Сразу сохраняем прогресс
        } else {
            alert('Недостаточно средств!');
        }
    },

    // ... (closeM и anim без изменений)
};
