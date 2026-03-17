
const ui = {
    openM: (id) => document.getElementById('m-'+id).style.display = 'flex',
    closeM: () => document.querySelectorAll('.modal').forEach(m => m.style.display='none'),
    update: (s) => {
        document.getElementById('balance').innerText = Math.floor(s.bal).toLocaleString();
        document.getElementById('u-name').innerText = s.name;
        document.getElementById('u-lvl').innerText = `LVL ${s.lvl}`;
        document.getElementById('eng-val').innerText = `${s.eng}/${s.max}`;
        document.getElementById('eng-fill').style.width = `${(s.eng/s.max)*100}%`;
        if(s.ava && !document.getElementById('u-ava').hasChildNodes()) {
            document.getElementById('u-ava').innerHTML = `<img src="${s.ava}" width="100%">`;
        }
    }
};

const tonConnect = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
    buttonRootId: 'ton-connect-btn'
});

tonConnect.onStatusChange(wallet => {
    if(wallet) {
        const addr = wallet.account.address;
        document.getElementById('wallet-addr').innerText = addr.slice(0,8)+'...'+addr.slice(-8);
        logic.saveWallet(addr);
    }
});
