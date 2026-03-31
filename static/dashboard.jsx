import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 NEURAL_PULSE DARK PALETTE ---
const CYBER = {
  bg: '#020406',
  card: '#0a0e14',
  primary: '#00f2fe',    
  secondary: '#7000ff', 
  success: '#39ff14',   
  warning: '#ffea00',   
  danger: '#ff003c',    
  ton: '#0088CC',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: '#1a1f26',
};

// --- 🔉 AUDIO ENGINE ---
const playSound = (freq, type = 'sine', dur = 0.1) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (e) {}
};

// --- 📈 MINI-CHART COMPONENT ---
const MiniChart = memo(({ data, color, height = 30 }) => {
  const chartData = (data && data.length > 1) ? data : [0, 0];
  const cleanData = chartData.map(v => (Number.isFinite(v) ? v : 0));
  const max = Math.max(...cleanData) || 1;
  const min = Math.min(...cleanData);
  const range = max - min || 1;
  const points = cleanData.map((val, i) => ({
    x: (i / (cleanData.length - 1)) * 100,
    y: height - ((val - min) / range) * height,
  }));
  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  return (
    <svg width="100%" height={height} style={{ marginTop: '15px', overflow: 'visible' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
});

const Dashboard = (props) => {
  const { data } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const logRef = useRef(null);

  // --- STATE ---
  const [logs, setLogs] = useState(['> INITIALIZING_NEURAL_OS...', '> KERNEL_STABLE']);
  const [users, setUsers] = useState(data?.usersList || []);
  const [stats, setStats] = useState({
    load: 10.7,
    lat: 101,
    agents: data?.totalUsers || 0,
    tonPool: 65.5,
    liquidity: 1000
  });
  const [history, setHistory] = useState({
    load: Array(15).fill(10),
    lat: Array(15).fill(100)
  });

  // --- 🛰️ REAL-TIME ENGINE (SSE) ---
  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        
        // 1. Системные показатели
        if (update.event_type === 'SYSTEM') {
          setStats(prev => ({
            ...prev,
            load: update.server_load ?? prev.load,
            lat: update.db_latency ?? prev.lat,
            agents: update.user_count ?? prev.agents,
            liquidity: update.total_liquidity ?? prev.liquidity
          }));
          setHistory(prev => ({
            load: [...prev.load.slice(1), update.server_load || 10],
            lat: [...prev.lat.slice(1), update.db_latency || 80],
          }));
        }

        // 2. РЕАЛЬНОЕ ОБНОВЛЕНИЕ ТАБЛИЦЫ ЮЗЕРОВ
        if (update.event_type === 'USER_UPDATE' || update.event_type === 'TRANSACTION') {
          setUsers(prev => {
            const userIdx = prev.findIndex(u => u.id === update.user_data.id);
            if (userIdx !== -1) {
              const newUsers = [...prev];
              newUsers[userIdx] = { ...newUsers[userIdx], ...update.user_data };
              return newUsers;
            }
            return [update.user_data, ...prev]; // Если новый юзер, добавляем в начало
          });
        }

        // 3. Обновление логов
        if (update.recent_event) {
          setLogs(prev => [...prev.slice(-15), `> ${new Date().toLocaleTimeString()}: ${update.recent_event}`]);
          if (update.event_type === 'TRANSACTION') playSound(900, 'sine', 0.05);
        }
      } catch (err) {
        console.error("Stream Error:", err);
      }
    };

    setTimeout(() => { setIsLoaded(true); playSound(600); }, 500);
    return () => eventSource.close();
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const toggleBan = (id) => {
    playSound(400, 'sawtooth');
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'banned' ? 'active' : 'banned' } : u));
  };

  if (!isLoaded) return <div style={{ background: '#000', height: '100vh', color: CYBER.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>LOAD_PULSE_STREAM...</div>;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; transition: filter 0.5s; }
        .header { margin-bottom: 25px; border-left: 2px solid ${CYBER.primary}; padding-left: 15px; position: relative; }
        .title { color: ${CYBER.primary}; font-size: 28px; letter-spacing: 2px; margin: 0; font-weight: 900; }
        .subtitle { font-size: 9px; opacity: 0.4; letter-spacing: 1px; margin-top: 5px; }
        
        .liquidity-block { margin: 20px 0; }
        .liq-value { font-size: 32px; font-weight: bold; color: ${CYBER.primary}; text-shadow: 0 0 10px rgba(0, 242, 254, 0.3); }
        .liq-label { font-size: 10px; color: ${CYBER.primary}; opacity: 0.8; letter-spacing: 1px; }

        .tabs { display: flex; gap: 30px; margin-bottom: 25px; border-bottom: 1px solid #1a1f26; }
        .tab { background: none; border: none; color: #333; padding: 10px 0; font-size: 12px; cursor: pointer; text-transform: uppercase; font-weight: bold; transition: 0.3s; }
        .tab.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 2px; position: relative; overflow: hidden; }
        .card-label { font-size: 9px; color: ${CYBER.primary}; text-transform: uppercase; margin-bottom: 8px; opacity: 0.8; }
        .card-value { font-size: 22px; font-weight: bold; display: flex; align-items: center; gap: 5px; }
        
        .ops-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
        .op-btn { background: #fff; color: #000; border: none; padding: 12px; font-size: 11px; font-weight: bold; cursor: pointer; border-radius: 2px; transition: 0.2s; }
        .op-btn:active { transform: scale(0.98); opacity: 0.8; }
        
        .cyber-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; color: ${CYBER.text}; }
        .cyber-table th { text-align: left; padding: 12px 8px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; text-transform: uppercase; font-size: 9px; }
        .cyber-table td { padding: 12px 8px; border-bottom: 1px solid rgba(255,255,255,0.02); transition: all 0.3s ease; }
        .cyber-table tr:hover td { background: rgba(0, 242, 254, 0.03); }
        
        .broadcast-input { width: 100%; background: #000; border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; padding: 12px; margin-top: 10px; font-family: inherit; font-size: 10px; outline: none; }
        .broadcast-input::placeholder { color: ${CYBER.subtext}; opacity: 0.5; }
        
        .emergency { filter: hue-rotate(-160deg) saturate(1.5); }
        .wave { width: 100%; height: 30px; margin-top: 20px; opacity: 0.4; }
        
        @keyframes pulse-row {
          0% { background: rgba(0, 242, 254, 0); }
          50% { background: rgba(0, 242, 254, 0.1); }
          100% { background: rgba(0, 242, 254, 0); }
        }
        .row-update { animation: pulse-row 1s ease-out; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${CYBER.bg}; }
        ::-webkit-scrollbar-thumb { background: ${CYBER.border}; }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <h1 className="title">NEURAL_PULSE</h1>
        <div className="subtitle">// ACCESS_ROOT // NODE: NL4 // OS: 9.8_LIVE</div>
        <div style={{ position: 'absolute', right: 0, top: 0, fontSize: '10px', color: CYBER.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '6px', height: '6px', background: CYBER.success, borderRadius: '50%', boxShadow: `0 0 8px ${CYBER.success}`, animation: 'blink 1.5s infinite' }}></span>
            STREAMING_ACTIVE
        </div>
      </div>

      {/* BALANCE SECTION */}
      <div className="liquidity-block">
        <div className="liq-value">{stats.liquidity.toLocaleString()} $NP</div>
        <div className="liq-label">TOTAL_NETWORK_LIQUIDITY</div>
      </div>

      {/* NAVIGATION */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ 01. Telemetry ]</button>
        <button className={`tab ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>[ 02. Agents ]</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid">
            <div className="card">
              <div className="card-label">Active_Agents</div>
              <div className="card-value">{stats.agents}U</div>
              <div style={{height: '30px', borderBottom: `2px solid ${CYBER.primary}`, opacity: 0.2, marginTop: '15px'}}></div>
            </div>
            <div className="card">
              <div className="card-label">Ton_Gateway_Pool</div>
              <div className="card-value">{stats.tonPool} 💎</div>
              <div style={{height: '30px', borderBottom: `2px solid ${CYBER.ton}`, opacity: 0.2, marginTop: '15px'}}></div>
            </div>
            <div className="card">
              <div className="card-label" style={{color: CYBER.success}}>Kernel_Load</div>
              <div className="card-value">{stats.load}%</div>
              <MiniChart data={history.load} color={CYBER.success} />
            </div>
            <div className="card">
              <div className="card-label" style={{color: CYBER.danger}}>Pulse_Latency</div>
              <div className="card-value">{stats.lat}ms</div>
              <MiniChart data={history.lat} color={CYBER.danger} />
            </div>
          </div>

          <div className="card">
            <div className="card-label">Core_Operations</div>
            <div className="ops-grid">
              <button className="op-btn" onClick={() => playSound(800)}>📢 Broadcast</button>
              <button className="op-btn" onClick={() => playSound(400)}>🧹 Purge</button>
              <button className="op-btn" onClick={() => playSound(600)}>💾 Sync</button>
              <button className="op-btn" style={{background: isEmergency ? CYBER.danger : '#fff', color: isEmergency ? '#fff' : '#000'}} onClick={() => { setIsEmergency(!isEmergency); playSound(200); }}>⚠️ Kill_Switch</button>
            </div>
            <input className="broadcast-input" placeholder="ENTER BROADCAST PACKET DATA..." value={broadcastMsg} onChange={(e) => setSearchTerm(e.target.value)} />
            
            <svg className="wave" viewBox="0 0 400 40">
                <path d="M0 20 Q 50 5, 100 20 T 200 20 T 300 20 T 400 20" fill="none" stroke={isEmergency ? CYBER.danger : CYBER.primary} strokeWidth="1">
                    <animate attributeName="d" dur="3s" repeatCount="indefinite" values="M0 20 Q 50 5, 100 20 T 200 20 T 300 20 T 400 20; M0 20 Q 50 35, 100 20 T 200 20 T 300 20 T 400 20; M0 20 Q 50 5, 100 20 T 200 20 T 300 20 T 400 20" />
                </path>
            </svg>
          </div>
        </>
      )}

      {activeTab === 'agents' && (
        <div className="card" style={{ animation: 'fadeIn 0.5s ease' }}>
          <div className="card-label">Agent_Registry_Database</div>
          <input className="broadcast-input" style={{marginBottom: '10px'}} placeholder="FILTER_BY_UID_OR_NAME..." onChange={(e) => setSearchTerm(e.target.value)} />
          <div style={{ overflowX: 'auto' }}>
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Control</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => String(u.username || u.id).toLowerCase().includes(searchTerm.toLowerCase())).map((u, i) => (
                  <tr key={u.id} style={{ opacity: u.status === 'banned' ? 0.3 : 1 }}>
                    <td style={{ color: CYBER.primary, fontWeight: 'bold' }}>{u.username || u.id}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {Number(u.balance || 0).toLocaleString()} <span style={{fontSize: '8px', opacity: 0.4}}>NP</span>
                    </td>
                    <td>
                        <span style={{ color: u.status === 'banned' ? CYBER.danger : CYBER.success, fontSize: '9px', fontWeight: 'bold' }}>
                            ● {(u.status || 'ACTIVE').toUpperCase()}
                        </span>
                    </td>
                    <td>
                      <button onClick={() => toggleBan(u.id)} style={{ background: 'none', border: `1px solid ${u.status === 'banned' ? CYBER.success : CYBER.danger}`, color: u.status === 'banned' ? CYBER.success : CYBER.danger, fontSize: '8px', padding: '4px 8px', cursor: 'pointer', borderRadius: '2px' }}>
                        {u.status === 'banned' ? 'REVIVE' : 'BAN'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LIVE FEED (GLOBAL FOOTER) */}
      <footer style={{ marginTop: '25px', borderTop: '1px solid #1a1f26', paddingTop: '15px' }}>
        <div className="card-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>[ Live_Network_Feed ]</span>
            <span style={{ animation: 'blink 1s infinite' }}>● REAL_TIME_SYNC</span>
        </div>
        <div ref={logRef} style={{ height: '80px', overflowY: 'auto', fontSize: '10px', marginTop: '10px', opacity: 0.5, lineHeight: '1.5' }}>
          {logs.map((l, i) => <div key={i} style={{ marginBottom: '2px', borderLeft: `1px solid ${CYBER.border}`, paddingLeft: '8px' }}>{l}</div>)}
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
