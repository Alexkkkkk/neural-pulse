import React, { useState, useEffect, memo, useMemo } from 'react';

// --- 🌌 ЦВЕТОВАЯ ПАЛИТРА NEURAL_PULSE V9.8 ---
const CYBER = {
  bg: '#000000',
  card: '#0a0d14',
  primary: '#00f2fe',
  ton: '#0088CC',
  success: '#39ff14',
  danger: '#ff003c',
  warning: '#ffea00',
  secondary: '#7000ff',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: 'rgba(0, 242, 254, 0.15)',
};

// --- 📈 КОМПОНЕНТ НЕОНОВОГО ГРАФИКА ---
const SparkGraph = memo(({ data, color, height = 45 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * (height * 0.7) - 5,
  }));

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;
  const gradId = `grad-${color.replace('#', '')}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
            style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={color} />
    </svg>
  );
});

// --- 📊 ИНДИКАТОР РЕСУРСА (ВЕРХНЯЯ ПАНЕЛЬ) ---
const TelemetryCard = ({ label, value, data, color }) => (
  <div style={{ flex: 1, minWidth: '140px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '10px', border: `1px solid ${CYBER.border}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
      <span style={{ color: '#4a5568', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color, fontSize: '11px', fontWeight: 'bold', fontFamily: 'Roboto Mono' }}>{Math.round(value)}%</span>
    </div>
    <SparkGraph data={data} color={color} height={30} />
  </div>
);

// --- 🗳️ ОСНОВНАЯ КАРТОЧКА ДАННЫХ ---
const DataCard = ({ label, value, unit, data, color, isTon }) => (
  <div className="card">
    <div className="label" style={{ color }}>{label}</div>
    <div className="val-main">
      {value}
      <span className="val-unit">{isTon ? '💎 ' : ''}{unit}</span>
    </div>
    <SparkGraph data={data} color={color} />
  </div>
);

// --- ⚙️ ОСНОВНОЙ КОМПОНЕНТ DASHBOARD ---
const Dashboard = (props) => {
  const { data: initialData } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');

  const [wallet, setWallet] = useState({ 
    connected: false, 
    address: null, 
    balance: 0, 
    shortAddress: 'OFFLINE' 
  });

  const [users] = useState(initialData?.usersList || []);
  const [stats, setStats] = useState({ cpu: 28, ram: 34, online: 0, ton: 0, latency: 24, liquidity: 0 });
  const [history, setHistory] = useState({
    cpu: Array(15).fill(28),
    ram: Array(15).fill(34),
    stability: Array(15).fill(100),
    online: Array(15).fill(0),
    ton: Array(15).fill(0),
    lat: Array(15).fill(24),
    liq: Array(15).fill(0)
  });

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      String(u.id).includes(searchTerm) || 
      String(u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const updateSystemData = async (newData = {}) => {
    let freshBalance = wallet.balance;

    if (wallet.connected && wallet.address) {
      try {
        const res = await fetch(`https://tonapi.io/v2/accounts/${wallet.address}`);
        const tonData = await res.json();
        freshBalance = (tonData.balance || 0) / 1e9;
        setWallet(prev => ({ ...prev, balance: freshBalance }));
      } catch (e) { console.warn("Balance sync failed"); }
    }

    setStats(prev => ({
      ...prev,
      cpu: newData.cpu ?? (prev.cpu + (Math.random() * 2 - 1)),
      ram: newData.ram ?? (prev.ram + (Math.random() * 1 - 0.5)),
      online: newData.online ?? prev.online,
      latency: newData.latency ?? (prev.latency + (Math.random() * 4 - 2)),
      liquidity: newData.liquidity ?? prev.liquidity
    }));

    setHistory(p => ({
      cpu: [...p.cpu.slice(1), newData.cpu ?? (p.cpu[p.cpu.length-1] + (Math.random() * 2 - 1))],
      ram: [...p.ram.slice(1), newData.ram ?? (p.ram[p.ram.length-1] + (Math.random() * 1 - 0.5))],
      stability: [...p.stability.slice(1), Math.max(0, 100 - ((newData.latency ?? p.lat[p.lat.length-1]) / 5))],
      online: [...p.online.slice(1), newData.online ?? p.online[p.online.length-1]],
      ton: [...p.ton.slice(1), freshBalance],
      lat: [...p.lat.slice(1), newData.latency ?? (p.lat[p.lat.length-1] + (Math.random() * 4 - 2))],
      liq: [...p.liq.slice(1), newData.liquidity ?? p.liq[p.liq.length-1]]
    }));
    setLastUpdate(new Date());
  };

  useEffect(() => {
    // --- ПРОВЕРКА НАЛИЧИЯ SDK TON ---
    if (!window.TON_CONNECT_UI) {
        console.warn("Waiting for TON_CONNECT_UI to load...");
        return;
    }

    const tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
      manifestUrl: 'https://np.bothost.tech/tonconnect-manifest.json',
      buttonRootId: 'ton-btn'
    });

    const unsubscribe = tonConnectUI.onStatusChange(w => {
      if (w) {
        setWallet({
          connected: true,
          address: w.account.address,
          balance: 0,
          shortAddress: `${w.account.address.slice(0,4)}...${w.account.address.slice(-4)}`
        });
      } else {
        setWallet({ connected: false, address: null, balance: 0, shortAddress: 'OFFLINE' });
      }
    });

    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.event_type === 'SYSTEM') {
           updateSystemData({
             cpu: update.core_load,
             ram: update.sync_memory,
             online: update.active_agents,
             latency: update.network_latency,
             liquidity: update.pulse_liquidity
           });
        }
      } catch (err) { console.error("Stream error", err); }
    };

    const interval = setInterval(() => updateSystemData({}), 10000);
    setTimeout(() => setIsLoaded(true), 600);

    return () => {
      eventSource.close();
      clearInterval(interval);
      unsubscribe();
    };
    // Добавлена проверка window.TON_CONNECT_UI в зависимости, чтобы эффект перезапустился при загрузке скрипта
  }, [wallet.connected, wallet.address, window.TON_CONNECT_UI]); 

  if (!isLoaded) return <div className="loading">CONNECTING_TO_NEURAL_PULSE_NODE...</div>;

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        .app-root { background: #000; min-height: 100vh; padding: 20px; font-family: 'Inter', sans-serif; color: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .header h1 { font-size: 24px; font-weight: 900; letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; }
        .nav-tabs { display: flex; gap: 20px; margin: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #4a5568; padding: 10px 0; font-size: 11px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; transition: 0.3s; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }
        .res-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 15px; margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 20px; border-radius: 12px; position: relative; overflow: hidden; }
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; opacity: 0.7; }
        .val-main { font-size: 32px; font-weight: 700; display: flex; align-items: baseline; }
        .val-unit { font-size: 10px; color: #4a5568; margin-left: 6px; font-weight: 800; }
        .pulse-dot { width: 6px; height: 6px; background: ${CYBER.success}; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 10px ${CYBER.success}; animation: blink 2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .cyber-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .cyber-table th { text-align: left; padding: 12px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; font-size: 9px; text-transform: uppercase; }
        .cyber-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); font-family: 'Roboto Mono'; }
        .search-input { width: 100%; background: #0c1017; border: 1px solid ${CYBER.border}; color: #fff; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-family: 'Roboto Mono'; outline: none; transition: 0.3s; }
        .search-input:focus { border-color: ${CYBER.primary}; box-shadow: 0 0 10px rgba(0, 242, 254, 0.1); }
        .loading { background: #000; height: 100vh; display: flex; align-items: center; justify-content: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; letter-spacing: 2px; }
      `}</style>

      <div className="header">
        <div>
          <h1>NEURAL_PULSE V9.8</h1>
          <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: wallet.connected ? CYBER.ton : CYBER.success, marginTop: '5px' }}>
            <span className="pulse-dot"></span>
            {wallet.connected ? `UPLINK_STABLE // ${wallet.shortAddress}` : 'SYSTEM_OPERATIONAL // SYNC: 10S'}
          </div>
        </div>
        <div id="ton-btn" style={{ transform: 'scale(0.9)', transformOrigin: 'right' }}></div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>OVERVIEW</button>
        <button className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>AGENT_DATABASE</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="res-panel">
            <TelemetryCard label="Core_Node_Load" value={stats.cpu} data={history.cpu} color={CYBER.primary} />
            <TelemetryCard label="Sync_Memory" value={stats.ram} data={history.ram} color={CYBER.secondary} />
            <TelemetryCard label="Stability" value={Math.max(0, 100 - (stats.latency / 5))} data={history.stability} color={CYBER.warning} />
          </div>

          <div className="grid">
            <DataCard label="Active_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
            <DataCard label="Live_Wallet_TON" value={wallet.connected ? wallet.balance.toFixed(2) : "0.00"} unit="TON" data={history.ton} color={CYBER.ton} isTon={true} />
            <DataCard label="Pulse_Liquidity" value={stats.liquidity.toLocaleString()} unit="$NP" data={history.liq} color={CYBER.warning} />
            <DataCard label="Network_Latency" value={Math.round(stats.latency)} unit="MS" data={history.lat} color={CYBER.danger} />
          </div>
        </>
      )}

      {activeTab === 'agents' && (
        <div className="card">
          <div className="label">Identity_Database_Search</div>
          <input 
            className="search-input" 
            placeholder="ENTER UID OR ALIAS..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div style={{ overflowX: 'auto' }}>
            <table className="cyber-table">
              <thead>
                <tr><th>Identity_UID</th><th>Pulse_Balance</th><th>Access_Status</th></tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? filteredUsers.map((u, i) => (
                  <tr key={i}>
                    <td style={{ color: CYBER.primary }}>{u.username || u.id}</td>
                    <td>{Number(u.balance || 0).toLocaleString()} <span style={{fontSize:'8px', opacity:0.3}}>$NP</span></td>
                    <td style={{ color: CYBER.success }}>AUTHORIZED</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', opacity: 0.3, padding: '20px' }}>NO_DATA_FOUND</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', opacity: 0.2, fontSize: '8px', fontFamily: 'Roboto Mono' }}>
        <div>NODE_HYBRID_ACTIVE // RENDER_V9.8</div>
        <div>LAST_PULSE: {lastUpdate.toLocaleTimeString()}</div>
      </footer>
    </div>
  );
};

export default Dashboard;
