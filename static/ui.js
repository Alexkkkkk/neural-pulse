const ui = {
    openM: (id) => {
        if(id === 'top') logic.loadTop();
        document.getElementById('m-'+id).style.display = 'flex';
    },
    closeM: () => document.querySelectorAll('.modal').forEach(m => m.style.display='none'),
    render: (s) => {
        document.getElementById('balance').innerText = Math.floor(s.bal).toLocaleString();
        document.getElementById('u-name').innerText = s.name;
        document.getElementById('u-lvl').innerText = `LVL ${s.lvl}`;
        if(s.ava && !document.getElementById('u-ava').innerHTML) {
            document.getElementById('u-ava').innerHTML = `<img src="${s.ava}" width="100%">`;
        }
    }
};

const tonConnect = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://neural-pulse.bothost.ru/tonconnect-manifest.json',
    buttonRootId: 'ton-connect-btn'
});
