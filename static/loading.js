const logic = {
    state: {
        id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "0",
        balance: 0,
        clickPower: 2,
        profitPerHour: 0,
        energy: 1000,
        maxEnergy: 1000,
        level: 1,
        name: window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "Agent"
    },

    // Расчет клика
    tap() {
        if (this.state.energy >= this.state.clickPower) {
            this.state.balance += this.state.clickPower;
            this.state.energy -= this.state.clickPower;
            return true;
        }
        return false;
    },

    // Фоновая регенерация энергии
    regen() {
        if (this.state.energy < this.state.maxEnergy) {
            this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + 1);
        }
    },

    async loadData() {
        try {
            const r = await fetch(`/api/user/${this.state.id}`);
            const d = await r.json();
            this.state.balance = parseFloat(d.balance) || 0;
            this.state.clickPower = d.click_lvl || 2;
            this.state.energy = d.energy || 1000;
        } catch (e) { console.error("Data sync error"); }
    },

    save() {
        fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                userId: this.state.id,
                balance: this.state.balance,
                energy: this.state.energy
            })
        });
    }
};
