import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

// --- 🌌 INFINITY-PULSE CORE PALETTE (v9.6) ---
const CYBER = {
  bg: '#020406',
  card: 'rgba(6, 9, 13, 0.95)',
  primary: '#00f2fe',    
  secondary: '#7000ff', 
  success: '#39ff14',   
  warning: '#ffea00',   
  danger: '#ff003c',    
  ton: '#0088CC',
  text: '#e2e8f0',
  subtext: '#8b949e',
  border: 'rgba(0, 242, 254, 0.25)',
};

// --- 🔉 QUANTUM AUDIO ENGINE ---
const playSound = (freq, type = 'sine', dur = 0.2) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (e) {}
};

// --- 📈 PRECISION MINI-CHART ---
const MiniChart = memo(({ data, color, height = 40 }) => {
  if (!data || data.length < 2) return <div style={{ height, background: 'rgba(0,242,254,0.02)', marginTop: '10px' }} />;
  const cleanData = data.map(v => (Number.isFinite(v) ? v : 0));
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
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.1" />
    </svg>
  );
});

// --- ⚡ NEURAL WAVE VISUALIZER ---
const NeuralWave = memo(({ active }) => (
  <svg viewBox="0 0 400 100" style={{ width: '100%', height: '60px', opacity: 0.7, marginTop: '15px' }}>
    <path
      d="M0 50 Q 50 10, 100 50 T 200 50 T 300 50 T 400 50"
      fill="none"
      stroke={active ? CYBER.danger : CYBER.primary}
      strokeWidth="2"
    >
      <animate attributeName="d" dur="2s" repeatCount="indefinite"
        values="M0 50 Q 50 10, 100 50 T 200 50 T 300 50 T 400 50; 
                M0 50 Q 50 90, 100 50 T 200 50 T 300 50 T 400 50; 
                M0 50 Q 50 10, 100 50 T 200 50 T 300 50 T 400 50" />
    </path>
  </svg>
));

const Dashboard = (props) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [bootProgress, setBootProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const logRef = useRef(null);
  
  const [logs, setLogs] = useState(['> MOUNTING_VOLUMES...', '> CONNECTING_TON...', '> AIRDROP_SYSTEM_READY']);
  
  const [users, setUsers] = useState(props.data?.usersList || [
    { id: '@alex_neo', ton: 65.5, refs: 12, taps: 845000, status: 'active' },
    { id: '@kander_dev', ton: 12.0, refs: 45, taps: 2100000, status: 'active' },
    { id: '@guest_01', ton: 0.0, refs: 2, taps: 15000, status: 'active' },
    { id: '@crypto_bot', ton: 1.5, refs: 0, taps: 120000, status: 'active' }
  ]);

  const [stats, setStats] = useState({
    users: users.length,
    tonPool: 1250.0,
    load: 10.7,
    lat: 101,
    ram: 83.8,
    disk: 18
  });

  const [history, setHistory] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setBootProgress(p => {
        if (p >= 100) { clearInterval(timer); setTimeout(() => setIsLoaded(true), 300); return 100; }
        return p + 10;
      });
    }, 30);

    const dataInterval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        load: Math.max(5, Math.min(95, prev.load + (Math.random() * 4 - 2))),
        lat: Math.max(80, Math.min(300, prev.lat + (Math.random() * 10 - 5))),
        ram: Math.max(80, Math.min(95, prev.ram + (Math.random() * 2 - 1)))
      }));
      setHistory(prev => [...prev.slice(-20), { 
        user_count: users.length, 
        total_balance: stats.tonPool, 
        server_load: stats.load, 
        db_latency: stats.lat 
      }]);
    }, 2000);

    return () => { clearInterval(timer); clearInterval(dataInterval); };
  }, [users.length, stats.tonPool, stats.load, stats.lat]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // --- AIRDROP LOGIC ---
  const runAirdrop = (type) => {
    let count = 0;
    setUsers(prev => prev.map(u => {
      if (u.status === 'banned') return u;
      
      let reward = 0;
      if (type === 'taps' && u.taps > 500000) reward = 10;
      if (type === 'refs' && u.refs > 10) reward = u.refs * 1.5;
      if (type === 'mass') reward = 1;

      if (reward > 0) {
        count++;
        return { ...u, ton: u.ton + reward };
      }
      return u;
    }));

    playSound(900, 'sine', 0.3);
    setLogs(prev => [...prev, `> AIRDROP_${type.toUpperCase()}: SUCCESSFUL FOR ${count} AGENTS`]);
  };

  const toggleBan = useCallback((userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'banned' ? 'active' : 'banned' } : u));
    playSound(300, 'sawtooth');
    setLogs(prev => [...prev, `> ALERT: USER ${userId} STATUS_CHANGED`]);
  }, []);

  const updateUser = (userId, newData) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...newData } : u));
    setEditingUser(null);
    playSound(800);
    setLogs(prev => [...prev, `> DB_UPDATE: ${userId} PARAMETERS_MODIFIED`]);
  };

  const exportToCSV = () => {
    const headers = 'User_ID,TON,Refs,Taps,Status\n';
    const rows = users.map(u => `${u.id},${u.ton},${u.refs},${u.taps},${u.status}\n`).join('');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `np_export_${new Date().getTime()}.csv`;
    a.click();
    playSound(1000, 'sine', 0.1);
  };

  if (!isLoaded) return (
    <div style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'monospace' }}>
      <div style={{ letterSpacing: '5px', marginBottom: '15px' }}>BOOTING_NEURAL_OS_v9.6</div>
      <div style={{ width: '200px', height: '2px', background: '#111' }}>
        <div style={{ width: `${bootProgress}%`, height: '100%', background: CYBER.primary, boxShadow: `0 0 10px ${CYBER.primary}` }} />
      </div>
    </div>
  );

  return (
    <div className={`app-root ${isEmergency ? 'emergency-mode' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; position: relative; overflow-x: hidden; }
        .app-root::after { content: ""; position: fixed; inset: 0; pointer-events: none; opacity: 0.03; z-index: 10; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02)); background-size: 100% 3px, 2px 100%; }

        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
        .main-title { font-size: 32px; letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; font-weight: 900; text-transform: uppercase; }
        
        .nav-tabs { display: flex; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid ${CYBER.border}; }
        .tab-btn { background: none; border: none; color: #444; cursor: pointer; padding: 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; font-weight: bold; }

        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 2px; position: relative; }
        .stat-label { font-size: 9px; color: ${CYBER.primary}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 5px; font-weight: bold; }
        .stat-value { font-size: 22px; font-weight: bold; display: flex; align-items: baseline; }
        .unit { font-size: 10px; margin-left: 4px; opacity: 0.5; }

        .op-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cyber-btn { background: #fff; color: #000; border: none; padding: 12px; font-size: 11px; font-family: inherit; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 2px; transition: 0.2s; text-transform: uppercase; }
        .cyber-btn:active { transform: scale(0.95); opacity: 0.8; }
        .btn-danger { background: ${CYBER.warning}; }
        .btn-airdrop { background: ${CYBER.success}; color: #000; font-size: 9px; padding: 8px; }

        .search-bar { width: 100%; background: #000; border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; padding: 12px; margin-bottom: 15px; font-family: inherit; border-radius: 2px; }
        .cyber-table-wrap { overflow-x: auto; }
        .cyber-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .cyber-table th { text-align: left; padding: 12px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }

        .action-btn { background: none; border: 1px solid #333; color: #fff; padding: 6px; cursor: pointer; font-size: 12px; border-radius: 2px; }
        .emergency-mode { filter: hue-rotate(-160deg) saturate(1.5); }
        
        .progress-mini { width: 100%; height: 4px; background: rgba(255,255,255,0.05); margin-top: 10px; position: relative; }
        .progress-bar { height: 100%; transition: 0.5s; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-content { background: #06090d; border: 1px solid ${CYBER.primary}; padding: 20px; width: 100%; max-width: 300px; }
      `}</style>

      {/* --- EDIT MODAL --- */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="stat-label">MOD_USER // {editingUser.id}</div>
            <div style={{marginTop: '10px'}}>
              <label className="stat-label" style={{fontSize: '7px'}}>TON BALANCE</label>
              <input className="search-bar" type="number" id="m-ton" defaultValue={editingUser.ton} />
              <label className="stat-label" style={{fontSize: '7px'}}>TAP COUNT</label>
              <input className="search-bar" type="number" id="m-taps" defaultValue={editingUser.taps} />
            </div>
            <div style={{display: 'flex', gap: '10px'}}>
              <button className="cyber-btn" style={{flex: 1}} onClick={() => updateUser(editingUser.id, {
                ton: parseFloat(document.getElementById('m-ton').value),
                taps: parseInt(document.getElementById('m-taps').value)
              })}>SAVE</button>
              <button className="cyber-btn" style={{flex: 1, background: '#222', color: '#fff'}} onClick={() => setEditingUser(null)}>EXIT</button>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="header">
        <div>
          <h1 className="main-title">NEURAL_PULSE</h1>
          <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '4px' }}>// ACCESS_ROOT // NODE: NL4 // OS: 9.6</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '20px', color: CYBER.ton, fontWeight: 'bold' }}>{stats.tonPool.toFixed(0)} TON</div>
          <div className="stat-label">AIRDROP_RESERVE</div>
        </div>
      </div>

      {/* --- TABS --- */}
      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ Overview ]</button>
        <button className={`tab-btn ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ Airdrop_Manager ]</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="stat-grid">
            <div className="card">
              <div className="stat-label">Agents</div>
              <div className="stat-value">{users.length}<span className="unit">U</span></div>
              <MiniChart data={history.map(h => h.user_count)} color={CYBER.primary} />
            </div>
            <div className="card">
              <div className="stat-label" style={{ color: CYBER.ton }}>Pool_Status</div>
              <div className="stat-value">{(stats.tonPool/2000*100).toFixed(1)}<span className="unit">%</span></div>
              <MiniChart data={history.map(h => h.total_balance)} color={CYBER.ton} />
            </div>
            <div className="card">
              <div className="stat-label" style={{ color: CYBER.success }}>Kernel_Load</div>
              <div className="stat-value" style={{ color: stats.load > 80 ? CYBER.danger : CYBER.success }}>
                {stats.load.toFixed(1)}<span className="unit">%</span>
              </div>
              <MiniChart data={history.map(h => h.server_load)} color={CYBER.success} />
            </div>
            <div className="card">
              <div className="stat-label" style={{ color: CYBER.danger }}>Latency</div>
              <div className="stat-value" style={{ color: stats.lat > 200 ? CYBER.danger : CYBER.warning }}>
                {Math.floor(stats.lat)}<span className="unit">ms</span>
              </div>
              <MiniChart data={history.map(h => h.db_latency)} color={CYBER.danger} />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '15px' }}>
            <div className="stat-label">Core_Operations</div>
            <div className="op-grid">
              <button className="cyber-btn" onClick={() => { playSound(600); setLogs(prev => [...prev, '> BROADCAST_SENT_TO_ALL']); }}>📢 Broadcast</button>
              <button className="cyber-btn" onClick={() => { playSound(800); setLogs(prev => [...prev, '> CACHE_PURGED_SUCCESSFULLY']); }}>🧹 Purge</button>
              <button className="cyber-btn" onClick={() => { playSound(400); setLogs(prev => [...prev, '> SYNCING_WITH_BLOCKCHAIN...']); }}>💾 Sync</button>
              <button className="cyber-btn btn-danger" onClick={() => { setIsEmergency(!isEmergency); playSound(150, 'sawtooth'); }}>
                ⚠️ {isEmergency ? 'Resume' : 'Kill_Switch'}
              </button>
            </div>
            <NeuralWave active={isEmergency} />
          </div>

          <div className="card" style={{ background: 'rgba(0,0,0,0.4)', height: '150px' }}>
            <div className="stat-label">[ LIVE_FEED ]</div>
            <div style={{ fontSize: '10px', height: '110px', overflowY: 'auto', opacity: 0.7 }}>
              {logs.map((l, i) => <div key={i} style={{ marginBottom: '4px', borderLeft: `2px solid ${CYBER.primary}`, paddingLeft: '5px' }}>{l}</div>)}
              <div ref={logRef} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'airdrop' && (
        <div className="card" style={{ padding: '15px' }}>
          {/* Quick Airdrop Actions */}
          <div className="stat-label" style={{ marginBottom: '10px' }}>Quick_Distribute</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '20px' }}>
            <button className="cyber-btn btn-airdrop" onClick={() => runAirdrop('taps')}>🏆 Taps (500k+)</button>
            <button className="cyber-btn btn-airdrop" onClick={() => runAirdrop('refs')}>👥 Refs (10+)</button>
            <button className="cyber-btn btn-airdrop" onClick={() => runAirdrop('mass')}>🌐 Mass +1 TON</button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              className="search-bar" 
              placeholder="SEARCH_BY_ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="action-btn" style={{ borderColor: CYBER.success, height: '42px', padding: '0 15px' }} onClick={exportToCSV} title="Export CSV">💾</button>
          </div>

          <div className="cyber-table-wrap">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>TON</th>
                  <th>Taps</th>
                  <th>Refs</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.id.toLowerCase().includes(searchTerm.toLowerCase())).map((u, i) => (
                  <tr key={i} style={{ opacity: u.status === 'banned' ? 0.3 : 1 }}>
                    <td style={{ color: CYBER.primary }}>{u.id}</td>
                    <td style={{ color: CYBER.success, fontWeight: 'bold' }}>{u.ton.toFixed(1)}</td>
                    <td style={{ opacity: 0.7 }}>{(u.taps / 1000).toFixed(1)}k</td>
                    <td style={{ color: CYBER.secondary }}>{u.refs}</td>
                    <td style={{ display: 'flex', gap: '8px' }}>
                      <button className="action-btn" onClick={() => setEditingUser(u)}>⚙️</button>
                      <button className="action-btn" style={{ color: u.status === 'banned' ? CYBER.success : CYBER.danger }} onClick={() => toggleBan(u.id)}>
                        {u.status === 'banned' ? '🔓' : '🚫'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer style={{ marginTop: '30px', textAlign: 'center', fontSize: '8px', opacity: 0.2, letterSpacing: '4px' }}>
        PROPERTY_OF_NEURAL_PULSE_NETWORK // 2026
      </footer>
    </div>
  );
};

export default Dashboard;
