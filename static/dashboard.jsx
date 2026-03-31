import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 INFINITY-PULSE CORE PALETTE ---
const CYBER = {
  bg: '#020406',
  card: 'rgba(6, 9, 13, 0.98)',
  primary: '#00f2fe',    
  secondary: '#7000ff', 
  success: '#39ff14',   
  warning: '#ffea00',   
  danger: '#ff003c',    
  ton: '#0088CC',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: 'rgba(0, 242, 254, 0.2)',
  glow: '0 0 15px rgba(0, 242, 254, 0.3)',
};

// --- 🔉 QUANTUM AUDIO ENGINE ---
const playSound = (freq, type = 'sine', dur = 0.15) => {
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

// --- 📈 PRECISION MINI-CHART ---
const MiniChart = memo(({ data, color, height = 40 }) => {
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
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible', display: 'block' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'all 0.5s ease' }} />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.05" />
    </svg>
  );
});

// --- ⚡ NEURAL WAVE VISUALIZER ---
const NeuralWave = memo(({ active }) => (
  <svg viewBox="0 0 400 60" style={{ width: '100%', height: '40px', opacity: 0.5, marginTop: '10px' }}>
    <path
      d="M0 30 Q 50 5, 100 30 T 200 30 T 300 30 T 400 30"
      fill="none"
      stroke={active ? CYBER.danger : CYBER.primary}
      strokeWidth="1"
    >
      <animate attributeName="d" dur="3s" repeatCount="indefinite"
        values="M0 30 Q 50 5, 100 30 T 200 30 T 300 30 T 400 30; 
                M0 30 Q 50 55, 100 30 T 200 30 T 300 30 T 400 30; 
                M0 30 Q 50 5, 100 30 T 200 30 T 300 30 T 400 30" />
    </path>
  </svg>
));

const Dashboard = (props) => {
  const { data } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const logRef = useRef(null);

  const [logs, setLogs] = useState(['> INITIALIZING_NEURAL_OS...', '> KERNEL_STABLE', `> DB_SYNC: ${data?.totalUsers || 0} AGENTS`]);
  const [users, setUsers] = useState(data?.usersList || []);
  const [stats, setStats] = useState({
    load: data?.currentLoad || 12,
    lat: data?.currentLat || 95,
    ram: data?.ramUsage || 44,
    totalUsers: data?.totalUsers || 0,
    totalTonPool: data?.total_balance || 4520.50
  });

  const [history, setHistory] = useState({
    load: data?.history?.load || Array(20).fill(12),
    lat: data?.history?.lat || Array(20).fill(90),
    tappers: data?.history?.tappers || Array(20).fill(50),
    inflow: data?.history?.inflow || Array(20).fill(0.5)
  });

  // --- 🛰️ REAL-TIME STREAM ---
  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.event_type === 'SYSTEM') {
          setStats(prev => ({
            ...prev,
            load: update.server_load ?? prev.load,
            lat: update.db_latency ?? prev.lat,
            ram: update.mem_usage ?? prev.ram,
            totalUsers: update.user_count ?? prev.totalUsers,
            totalTonPool: update.total_balance ?? prev.totalTonPool
          }));
          setHistory(prev => ({
            load: [...prev.load.slice(1), update.server_load || 10],
            lat: [...prev.lat.slice(1), update.db_latency || 80],
            tappers: [...prev.tappers.slice(1), update.user_count || 0],
            inflow: [...prev.inflow.slice(1), update.active_wallets || 0]
          }));
        }
        if (update.recent_event) {
          setLogs(prev => [...prev.slice(-15), `> ${update.recent_event}`]);
        }
      } catch (err) { console.error("Sync failed"); }
    };
    setTimeout(() => { setIsLoaded(true); playSound(600, 'sine', 0.2); }, 800);
    return () => eventSource.close();
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  // --- ⚡ ACTIONS ---
  const toggleBan = async (userId) => {
    playSound(400, 'sawtooth');
    try {
      const response = await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_ban', userId })
      });
      if (response.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'banned' ? 'active' : 'banned' } : u));
        setLogs(prev => [...prev, `> CMD_EXEC: TARGET_ID_${userId}_STATUS_CHANGED`]);
      }
    } catch (e) { setLogs(prev => [...prev, `> CMD_FAIL: ${e.message}`]); }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg) return;
    playSound(1000, 'sine', 0.4);
    try {
      await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'broadcast', message: broadcastMsg })
      });
      setBroadcastMsg('');
      setLogs(prev => [...prev, '> BROADCAST_PULSE_SENT_TO_ALL_NODES']);
    } catch (e) { console.error(e); }
  };

  if (!isLoaded) return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'monospace' }}>LOADING_NEURAL_OS...</div>;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; transition: 0.5s; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; margin-bottom: 15px; position: relative; overflow: hidden; border-radius: 4px; }
        .label { font-size: 8px; color: ${CYBER.primary}; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6; }
        .value { font-size: 24px; font-weight: 900; margin-top: 5px; letter-spacing: -1px; }
        .unit { font-size: 11px; opacity: 0.4; margin-left: 5px; }
        .nav-tabs { display: flex; gap: 20px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #444; padding: 12px 0; font-size: 10px; cursor: pointer; text-transform: uppercase; transition: 0.3s; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; text-shadow: ${CYBER.glow}; }
        .cyber-btn { background: ${CYBER.primary}; color: #000; border: none; padding: 10px 15px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase; border-radius: 2px; }
        .emergency-btn { width: 100%; background: transparent; color: ${CYBER.danger}; border: 1px solid ${CYBER.danger}; padding: 15px; font-weight: bold; cursor: pointer; margin-top: 10px; letter-spacing: 2px; transition: 0.3s; }
        .emergency-btn:hover { background: ${CYBER.danger}; color: #fff; }
        .emergency { filter: hue-rotate(-160deg) saturate(1.5); }
        .cyber-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
        .cyber-table th { text-align: left; padding: 10px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; font-size: 10px; }
        .cyber-table td { padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .broadcast-input { width: 100%; background: rgba(0,0,0,0.4); border: 1px solid ${CYBER.border}; color: #fff; padding: 12px; margin-top: 10px; font-family: inherit; outline: none; border-radius: 4px; }
        .ton-gateway { text-decoration: none; color: #fff; background: ${CYBER.ton}; padding: 8px 16px; font-size: 10px; border-radius: 20px; font-weight: bold; display: inline-flex; align-items: center; gap: 8px; transition: 0.3s; box-shadow: 0 0 10px rgba(0,136,204,0.3); }
        .ton-gateway:hover { transform: translateY(-1px); box-shadow: 0 0 20px rgba(0,136,204,0.5); }
      `}</style>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '26px', letterSpacing: '4px', fontWeight: '900' }}>NEURAL_PULSE</h1>
          <div style={{ fontSize: '9px', opacity: 0.5 }}>OS_v9.8 // BOTH_HOST_NL_NODE</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <a href="/ton-connect" className="ton-gateway">
            <span>💎</span> TON_BRIDGE_GATEWAY
          </a>
          <div className="label" style={{ marginTop: '15px' }}>Total_Network_Pool</div>
          <div className="value" style={{ color: CYBER.ton }}>{stats.totalTonPool.toLocaleString()}<span className="unit">TON</span></div>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ 01. Telemetry ]</button>
        <button className={`tab-btn ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ 02. Agent_Control ]</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div className="card">
              <div className="label">Active_Agents</div>
              <div className="value">{stats.totalUsers}<span className="unit">NODE</span></div>
              <MiniChart data={history.tappers} color={CYBER.success} />
            </div>
            <div className="card">
              <div className="label">System_Load</div>
              <div className="value">{Number(stats.load).toFixed(1)}%</div>
              <MiniChart data={history.load} color={CYBER.primary} />
            </div>
            <div className="card">
              <div className="label">API_Latency</div>
              <div className="value">{Number(stats.lat).toFixed(0)}<span className="unit">ms</span></div>
              <MiniChart data={history.lat} color={CYBER.warning} />
            </div>
          </div>

          <div className="card">
            <div className="label">Memory_Buffer_Allocation</div>
            <div style={{ width: '100%', height: '4px', background: '#111', marginTop: '12px' }}>
              <div style={{ width: `${stats.ram}%`, height: '100%', background: CYBER.primary, boxShadow: CYBER.glow }} />
            </div>
            <div style={{ textAlign: 'right', fontSize: '9px', marginTop: '6px', opacity: 0.6 }}>{stats.ram}% LOADED</div>
          </div>

          <div className="card">
            <div className="label">Encrypted_Event_Log</div>
            <div ref={logRef} style={{ height: '120px', overflowY: 'auto', fontSize: '10px', marginTop: '10px', lineHeight: '1.8', opacity: 0.8 }}>
              {logs.map((log, i) => (
                <div key={i} style={{ borderLeft: `1px solid ${CYBER.border}`, paddingLeft: '10px', marginBottom: '4px' }}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="label">Global_Network_Broadcast</div>
            <input className="broadcast-input" placeholder="ENTER PACKET DATA..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />
            <button className="cyber-btn" style={{ marginTop: '12px', width: '100%' }} onClick={handleBroadcast}>Push to all Nodes</button>
          </div>

          <button className="emergency-btn" onClick={() => { setIsEmergency(!isEmergency); playSound(200, 'square', 0.5); }}>
            {isEmergency ? 'RECOVERY_INITIALIZED' : 'CORE_KILL_SWITCH'}
          </button>
          <NeuralWave active={isEmergency} />
        </>
      )}

      {activeTab === 'airdrop' && (
        <div className="card">
          <div className="label">User_Database_Index</div>
          <input className="broadcast-input" style={{marginBottom: '15px'}} placeholder="SEARCH_BY_UID_OR_USERNAME..." onChange={(e) => setSearchTerm(e.target.value)} />
          <div style={{ overflowX: 'auto' }}>
            <table className="cyber-table">
              <thead>
                <tr><th>Identity</th><th>Pulse_Balance</th><th>Status</th><th>Control</th></tr>
              </thead>
              <tbody>
                {users.filter(u => String(u.id).includes(searchTerm) || String(u.username || '').toLowerCase().includes(searchTerm.toLowerCase())).map((u, i) => (
                  <tr key={i} style={{ opacity: u.status === 'banned' ? 0.3 : 1 }}>
                    <td style={{ color: CYBER.primary }}>{u.username || u.id}</td>
                    <td>{Number(u.balance || 0).toLocaleString()} <span style={{fontSize:'9px', opacity:0.4}}>NP</span></td>
                    <td style={{ color: u.status === 'banned' ? CYBER.danger : CYBER.success }}>{(u.status || 'ACTIVE').toUpperCase()}</td>
                    <td>
                      <button className="cyber-btn" onClick={() => toggleBan(u.id)} style={{ padding: '5px 8px', fontSize: '9px', background: u.status === 'banned' ? CYBER.success : CYBER.danger, color: '#fff' }}>
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

      <footer style={{ textAlign: 'center', fontSize: '8px', opacity: 0.2, marginTop: '30px', letterSpacing: '2px' }}>
        NEURAL_PULSE_NETWORK // SECURED_BY_BOTH_HOST_STABLE_V2
      </footer>
    </div>
  );
};

export default Dashboard;
