import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 NEURAL_PULSE CORE PALETTE ---
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

  const [logs, setLogs] = useState(['> INITIALIZING_NEURAL_OS...', '> KERNEL_STABLE']);
  const [users, setUsers] = useState(data?.usersList || []);
  const [stats, setStats] = useState({
    load: 10.7,
    lat: 101,
    agents: 1,
    tonPool: 65.5,
    liquidity: 1000
  });

  const [history, setHistory] = useState({
    load: [15, 10, 20, 15, 12, 10, 8, 5, 2],
    lat: [100, 100, 100, 100, 100, 100, 101, 150]
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
            agents: update.user_count ?? prev.agents,
          }));
          setHistory(prev => ({
            load: [...prev.load.slice(1), update.server_load || 10],
            lat: [...prev.lat.slice(1), update.db_latency || 80],
          }));
        }
        if (update.recent_event) {
          setLogs(prev => [...prev.slice(-15), `> ${update.recent_event}`]);
        }
      } catch (err) { console.error("Sync failed"); }
    };
    setTimeout(() => { setIsLoaded(true); playSound(600); }, 500);
    return () => eventSource.close();
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  if (!isLoaded) return <div style={{ background: '#000', height: '100vh' }} />;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; transition: filter 0.5s; }
        .header { margin-bottom: 25px; border-left: 2px solid ${CYBER.primary}; padding-left: 15px; position: relative; }
        .title { color: ${CYBER.primary}; font-size: 28px; letter-spacing: 2px; margin: 0; font-weight: 900; }
        .subtitle { font-size: 9px; opacity: 0.4; letter-spacing: 1px; margin-top: 5px; }
        
        .liquidity-block { margin: 20px 0; }
        .liq-value { font-size: 32px; font-weight: bold; color: ${CYBER.primary}; }
        .liq-label { font-size: 10px; color: ${CYBER.primary}; opacity: 0.8; letter-spacing: 1px; }

        .tabs { display: flex; gap: 30px; margin-bottom: 25px; border-bottom: 1px solid #1a1f26; }
        .tab { background: none; border: none; color: #333; padding: 10px 0; font-size: 12px; cursor: pointer; text-transform: uppercase; font-weight: bold; }
        .tab.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 2px; }
        .card-label { font-size: 9px; color: ${CYBER.primary}; text-transform: uppercase; margin-bottom: 8px; opacity: 0.8; }
        .card-value { font-size: 22px; font-weight: bold; display: flex; align-items: center; gap: 5px; }
        
        .ops-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
        .op-btn { background: #fff; color: #000; border: none; padding: 12px; font-size: 11px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 2px; }
        .op-btn:active { opacity: 0.7; }
        
        .emergency { filter: hue-rotate(-160deg) saturate(1.2); }
        .broadcast-input { width: 100%; background: #000; border: 1px solid ${CYBER.border}; color: #fff; padding: 10px; margin-top: 10px; font-family: inherit; font-size: 10px; outline: none; }
        
        .wave { width: 100%; height: 30px; margin-top: 20px; opacity: 0.5; }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <h1 className="title">NEURAL_PULSE</h1>
        <div className="subtitle">// ACCESS_ROOT // NODE: NL4 // OS: 9.8</div>
        <div style={{ position: 'absolute', right: 0, top: 0, fontSize: '10px', color: CYBER.ton }}>TON_CONNECTED</div>
      </div>

      {/* LIQUIDITY SECTION */}
      <div className="liquidity-block">
        <div className="liq-value">{stats.liquidity.toLocaleString()} $NP</div>
        <div className="liq-label">TOTAL_LIQUIDITY</div>
      </div>

      {/* NAVIGATION */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ Overview ]</button>
        <button className={`tab ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>[ Agent_Control ]</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid">
            <div className="card">
              <div className="card-label">Agents</div>
              <div className="card-value">{stats.agents}U</div>
              <div style={{height: '30px', borderBottom: `2px solid ${CYBER.primary}`, opacity: 0.3, marginTop: '15px'}}></div>
            </div>
            <div className="card">
              <div className="card-label">Ton_Pool</div>
              <div className="card-value">{stats.tonPool} 💎</div>
              <div style={{height: '30px', borderBottom: `2px solid ${CYBER.ton}`, opacity: 0.3, marginTop: '15px'}}></div>
            </div>
            <div className="card">
              <div className="card-label" style={{color: CYBER.success}}>Kernel_Load</div>
              <div className="card-value">{stats.load}%</div>
              <MiniChart data={history.load} color={CYBER.success} />
            </div>
            <div className="card">
              <div className="card-label" style={{color: CYBER.danger}}>Latency</div>
              <div className="card-value">{stats.lat}ms</div>
              <MiniChart data={history.lat} color={CYBER.danger} />
            </div>
          </div>

          {/* CORE OPERATIONS */}
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-label">Core_Operations</div>
            <div className="ops-grid">
              <button className="op-btn" onClick={() => playSound(800)}>📢 Broadcast</button>
              <button className="op-btn" onClick={() => playSound(400)}>🧹 Purge</button>
              <button className="op-btn" onClick={() => playSound(600)}>💾 Sync</button>
              <button className="op-btn" onClick={() => { setIsEmergency(!isEmergency); playSound(200); }}>⚠️ Kill_Switch</button>
            </div>
            
            <input className="broadcast-input" placeholder="ENTER BROADCAST PACKET..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />

            <svg className="wave" viewBox="0 0 400 40">
                <path d="M0 20 Q 50 5, 100 20 T 200 20 T 300 20 T 400 20" fill="none" stroke={isEmergency ? CYBER.danger : CYBER.primary} strokeWidth="1">
                    <animate attributeName="d" dur="3s" repeatCount="indefinite" values="M0 20 Q 50 5, 100 20 T 200 20 T 300 20 T 400 20; M0 20 Q 50 35, 100 20 T 200 20 T 300 20 T 400 20; M0 20 Q 50 5, 100 20 T 200 20 T 300 20 T 400 20" />
                </path>
            </svg>
          </div>

          {/* LOGS */}
          <div className="card">
             <div className="card-label">Live_Feed</div>
             <div ref={logRef} style={{ height: '80px', overflowY: 'auto', fontSize: '10px', marginTop: '10px', opacity: 0.6 }}>
                {logs.map((l, i) => <div key={i} style={{marginBottom: '4px'}}>{l}</div>)}
             </div>
          </div>
        </>
      )}

      {activeTab === 'agents' && (
        <div className="card">
          <div className="card-label">Agent_Database</div>
          <input className="broadcast-input" placeholder="SEARCH AGENTS..." onChange={(e) => setSearchTerm(e.target.value)} />
          <div style={{ marginTop: '15px', fontSize: '11px' }}>
            {users.filter(u => String(u.username).includes(searchTerm)).map((u, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1a1f26' }}>
                <span>{u.username || u.id}</span>
                <span style={{ color: CYBER.primary }}>{u.balance} NP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer style={{ textAlign: 'center', fontSize: '8px', opacity: 0.2, marginTop: '20px' }}>
        NEURAL_PULSE_NETWORK // SECURED_STABLE_V2
      </footer>
    </div>
  );
};

export default Dashboard;
