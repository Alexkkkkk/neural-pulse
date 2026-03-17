const ui = {
    currentModal: null,

    init() {
        this.update();
        document.getElementById('tap-target').onclick = () => logic.tap();
    },

    update() {
        document.getElementById('balance').innerText = Math.floor(logic.user.balance);
        document.getElementById('eng-val').innerText = `${logic.user.energy}/${logic.user.max_energy}`;
        document.getElementById('eng-fill').style.width = (logic.user.energy / logic.user.max_energy * 100) + '%';
    },

    openM(id) {
        if (this.currentModal) this.closeM();
        const m = document.getElementById('m-' + id);
        if (m) {
            m.style.display = 'flex';
            this.currentModal = m;
        }
    },

    closeM() {
        if (this.currentModal) {
            this.currentModal.style.display = 'none';
            this.currentModal = null;
        }
    }
};
