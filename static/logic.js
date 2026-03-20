const logic = {
    user: null,

    async init(userIdFromTg = null, userNameFromTg = null, photoUrlFromTg = null) {
        const userId = userIdFromTg || "12345";
        const firstName = userNameFromTg || "Agent";
        const photoUrl = photoUrlFromTg || "";

        try {
            const res = await fetch(`/api/user/${userId}?username=${encodeURIComponent(firstName)}&photo_url=${encodeURIComponent(photoUrl)}`);
            const data = await res.json();

            this.user = {
                user_id: String(userId),
                username: data.username || firstName,
                photo_url: data.photo_url || photoUrl,
                balance: Number(data.balance || 0),
                energy: Number(data.energy ?? 1000),
                max_energy: Number(data.max_energy || 1000),
                click_lvl: Number(data.click_lvl || 1),
                profit_hr: Number(data.profit_hr || 0),
                lvl: Number(data.lvl || 1),
                wallet: data.wallet || null
            };

            if (typeof ui !== 'undefined') ui.init();
            this.startLoops();
            return true;
        } catch (e) { 
            console.error("Logic Init Error:", e);
            return false; 
        }
    },

    tap(e) {
        if (e.type === 'touchstart') e.preventDefault();
        if (!this.user || this.user.energy < this.user.click_lvl) return;
        
        this.user.balance += this.user.click_lvl;
        this.user.energy -= this.user.click_lvl;
        
        this.checkLvl();
        if (typeof ui !== 'undefined') ui.update();
        this.anim(e);
        
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    },

    async saveWallet(address) {
        if (!this.user) return;
        this.user.wallet = address;
        
        // Обновляем UI если модалка открыта
        const statusEl = document.getElementById('wallet-status');
        if (statusEl) {
            statusEl.innerText = address ? address.slice(0,6)+'...'+address.slice(-4) : "Not Connected";
        }
        
        try {
            await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.user.user_id, address: address })
            });
        } catch (err) { console.warn("Save Wallet Error:", err); }
    },

    async disconnectWallet() {
        if (typeof tonConnectUI !== 'undefined') {
            await tonConnectUI.disconnect();
            // wallet status обновится через onStatusChange автоматически
            if (typeof ui !== 'undefined') ui.openM('wallet');
        }
    },

    checkLvl() {
        const newLvl = Math.floor(this.user.balance / 100000) + 1;
        if (newLvl > this.user.lvl) {
            this.user.lvl = newLvl;
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        }
    },

    anim(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const p = document.createElement('div');
        p.className = 'tap-pop';
        p.innerText = `+${this.user.click_lvl}`;
        p.style.left = `${clientX}px`; 
        p.style.top = `${clientY}px`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 800);
    },

    async buyUpgrade(type) {
        if (!this.user) return;
        let success = false;
        
        if (type === 'tap' && this.user.balance >= 5000) {
            this.user.balance -= 5000; this.user.click_lvl += 1; success = true;
        } else if (type === 'energy' && this.user.balance >= 10000) {
            this.user.balance -= 10000; this.user.max_energy += 500; this.user.energy += 500; success = true;
        } else if (type === 'profit' && this.user.balance >= 25000) {
            this.user.balance -= 25000; this.user.profit_hr += 500; success = true;
        }
        
        if (success) {
            if (typeof ui !== 'undefined') { 
                ui.update(); 
                ui.openM(type === 'profit' ? 'mine' : 'boost'); 
            }
            await this.save();
        }
    },

    async save() {
        if (!this.user) return;
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user.user_id,
                    balance: Math.floor(this.user.balance),
                    energy: Math.floor(this.user.energy),
                    max_energy: this.user.max_energy,
                    click_lvl: this.user.click_lvl,
                    profit_hr: this.user.profit_hr,
                    lvl: this.user.lvl
                })
            });
        } catch (err) { console.warn("Save Error:", err); }
    },

    startLoops() {
        setInterval(() => {
            if (!this.user) return;
            // Регенерация энергии
            if (this.user.energy < this.user.max_energy) {
                this.user.energy = Math.min(this.user.max_energy, this.user.energy + 1.5);
            }
            // Пассивный доход
            if (this.user.profit_hr > 0) {
                this.user.balance += (this.user.profit_hr / 3600);
            }
            if (typeof ui !== 'undefined') ui.update();
        }, 1000);
        
        // Автосохранение каждые 15 секунд
        setInterval(() => this.save(), 15000);
    }
};
