import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 ЦВЕТОВАЯ ПАЛИТРА NEURAL_PULSE (Hybrid Stealth) ---
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

// --- 📈 НЕОНОВЫЙ ГРАФИК (SparkGraph) ---
const SparkGraph = memo(({ data, color, height = 50 }) => {
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
  const gradId = `grad-${color.replace('#', '')}`;

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
    </svg>
  );
});

// --- 📊 ИНДИКАТОРЫ РЕСУРСОВ (Telemetry) ---
const TelemetryBar = ({ label, value, color }) => (
  <div style={{ flex: 1, minWidth: '120px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
      <span style={{ color: '#4a5568', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color, fontSize: '10px', fontWeight: 'bold' }}>{Math.round(value)}%</span>
    </div>
    <div style={{ height: '4px', background: '#1a1d26', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ 
        width: `${Math.min(value, 100)}%`, height: '100%', background: color, 
        boxShadow: `0 0 10px ${color}`, transition: 'width 1s ease'
      }} />
    </div>
  </div>
);

// --- 🗳️ КАРТОЧКА ДАННЫХ ---
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

const Dashboard = (props) => {
  const { data: initialData } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const logRef = useRef(null);

  const [logs, setLogs] = useState(['> INITIALIZING_NEURAL_CORE...', '> ENCRYPTED_LINK_ESTABLISHED']);
  const [users, setUsers] = useState(initialData?.usersList || []);
  const [stats, setStats] = useState({ cpu: 0, ram: 0, storage: 22, online: 0, ton: 0, latency: 0, liquidity: 0 });
  const [history, setHistory] = useState({
    cpu: Array(20).fill(0),
    online: Array(20).fill(0),
    wallets: Array(20).fill(0),
    lat: Array(20).fill(0),
    liq: Array(20).fill(0)
  });

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.event_type === 'SYSTEM') {
          setStats(p => ({
            ...p, 
            cpu: update.core_load || p.cpu,
            ram: update.sync_memory || p.ram,
            online: update.active_agents || p.online,
            ton: update.ton_reserve || p.ton,
            latency: update.network_latency || p.latency,
            liquidity: update.total_liquidity || p.liquidity
          }));
          setHistory(p => ({
            cpu: [...p.cpu.slice(1), update.core_load || 0],
            online: [...p.online.slice(1), update.active_agents || 0],
            wallets: [...p.wallets.slice(1), update.ton_reserve || 0],
            lat: [...p.lat.slice(1), update.network_latency || 0],
            liq: [...p.liq.slice(1), update.total_liquidity || 0]
          }));
        }
        if (update.recent_event) {
          setLogs(prev => [...prev.slice(-10), `> ${update.recent_event}`]);
        }
      } catch (err) { console.error("Stream error", err); }
    };
    setTimeout(() => setIsLoaded(true), 600);
    return () => eventSource.close();
  }, []);

  const toggleBan = async (userId) => {
    try {
      const res = await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_ban', userId })
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'banned' ? 'active' : 'banned' } : u));
        setLogs(p => [...p, `> USER_ID_${userId}_STATUS_CHANGED`]);
      }
    } catch (e) { console.error(e); }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg) return;
    try {
      await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'broadcast', message: broadcastMsg })
      });
      setBroadcastMsg('');
      setLogs(p => [...p, '> GLOBAL_BROADCAST_SENT']);
    } catch (e) { console.error(e); }
  };

  if (!isLoaded) return <div className="loading">CONNECTING_TO_NEURAL_PULSE_NODE...</div>;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        .app-root { background: #000; min-height: 100vh; padding: 25px; font-family: 'Inter', sans-serif; color: #fff; }
        .header { margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header h1 { font-size: 26px; font-weight: 900; letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; }
        
        .nav-tabs { display: flex; gap: 20px; margin-bottom: 25px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #4a5568; padding: 10px 0; font-size: 11px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }

        .res-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 20px; border-radius: 12px; }
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
        .val-main { font-size: 32px; font-weight: 700; display: flex; align-items: baseline; }
        .val-unit { font-size: 10px; color: #4a5568; margin-left: 8px; font-weight: 800; }

        .cyber-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
        .cyber-table th { text-align: left; padding: 12px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; font-size: 10px; }
        .cyber-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        
        .broadcast-input { width: 100%; background: #000; border: 1px solid ${CYBER.border}; color: #fff; padding: 12px; border-radius: 6px; font-family: inherit; margin-bottom: 10px; }
        .op-btn { background: ${CYBER.primary}; color: #000; border: none; padding: 12px 20px; font-size: 10px; font-weight: 900; cursor: pointer; border-radius: 4px; text-transform: uppercase; }
        .btn-kill { background: ${CYBER.danger}; color: #fff; margin-top: 15px; width: 100%; }

        .emergency { filter: saturate(0) brightness(0.7) sepia(1) hue-rotate(-50deg); }
        .loading { background: #000; height: 100vh; display: flex; align-items: center; justify-content: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; font-size: 12px; }
      `}</style>

      <div className="header">
        <div>
          <h1>NEURAL_PULSE V9.8</h1>
          <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: CYBER.success, marginTop: '5px' }}>● SYSTEM_OPERATIONAL // SECURE_LINK_v4</div>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>OVERVIEW</button>
        <button className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>AGENT_DATABASE</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="res-panel">
            <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
              <TelemetryBar label="Core_Node_Load" value={stats.cpu} color={CYBER.primary} />
              <TelemetryBar label="Sync_Memory" value={stats.ram} color={CYBER.secondary} />
              <TelemetryBar label="Network_Stability" value={100 - (stats.latency / 5)} color={CYBER.warning} />
            </div>
          </div>

          <div className="grid">
            <DataCard label="Active_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
            <DataCard label="Ton_Reserve" value={stats.ton.toFixed(1)} unit="TON" data={history.wallets} color={CYBER.ton} isTon={true} />
            <DataCard label="Pulse_Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />
            <DataCard label="Network_Latency" value={stats.latency} unit="MS" data={history.lat} color={CYBER.danger} />
          </div>

          <div className="card" style={{ marginTop: '15px' }}>
            <div className="label" style={{ color: CYBER.primary }}>Global_Broadcast</div>
            <textarea className="broadcast-input" rows="2" placeholder="ENTER MESSAGE FOR ALL AGENTS..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />
            <button className="op-btn" onClick={handleBroadcast}>Execute_Broadcast</button>
          </div>

          <button className="op-btn btn-kill" onClick={() => setIsEmergency(!isEmergency)}>
            {isEmergency ? 'DISMISS_EMERGENCY' : 'INITIALIZE_KILL_SWITCH'}
          </button>
        </>
      )}

      {activeTab === 'agents' && (
        <div className="card">
          <div className="label">Search_Identity_DB</div>
          <input className="broadcast-input" placeholder="SEARCH BY UID OR ALIAS..." onChange={(e) => setSearchTerm(e.target.value)} />
          <div style={{ overflowX: 'auto' }}>
            <table className="cyber-table">
              <thead>
                <tr><th>Identity</th><th>Pulse_Balance</th><th>Status</th><th>Control</th></tr>
              </thead>
              <tbody>
                {users.filter(u => String(u.id).includes(searchTerm) || String(u.username || '').toLowerCase().includes(searchTerm.toLowerCase())).map((u, i) => (
                  <tr key={i} style={{ opacity: u.status === 'banned' ? 0.3 : 1 }}>
                    <td style={{ color: CYBER.primary, fontWeight: 'bold' }}>{u.username || u.id}</td>
                    <td>{Number(u.balance || 0).toLocaleString()} <span style={{fontSize:'8px', opacity:0.4}}>NP</span></td>
                    <td style={{ color: u.status === 'banned' ? CYBER.danger : CYBER.success }}>{(u.status || 'ACTIVE').toUpperCase()}</td>
                    <td>
                      <button className="op-btn" onClick={() => toggleBan(u.id)} style={{ padding: '6px 12px', fontSize: '8px' }}>
                        {u.status === 'banned' ? 'REVIVE' : 'TERMINATE'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer style={{ marginTop: '20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Roboto Mono', fontSize: '8px', opacity: 0.2 }}>
          {`HEARTBEAT_STABLE: ${new Date().toLocaleTimeString()} // CORE_v9.8_HYBRID`}
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
