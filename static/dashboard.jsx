import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

// --- 🌌 INFINITY-PULSE CORE PALETTE (v9.5) ---
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
  if (!data || data.length < 2) return <div style={{ height }} />;
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
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.08" />
    </svg>
  );
});

// --- ⚡ NEURAL WAVE VISUALIZER ---
const NeuralWave = memo(({ active }) => (
  <svg viewBox="0 0 400 100" style={{ width: '100%', height: '60px', opacity: 0.7 }}>
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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' или 'airdrop'
  const [bootProgress, setBootProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [logs, setLogs] = useState(['> MOUNTING_VOLUMES...', '> CONNECTING_TON...', '> PULSE_READY']);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const logRef = useRef(null);

  // --- ДАННЫЕ (Интеграция с твоим бэкендом) ---
  const [users, setUsers] = useState(props.data?.usersList || [
    { id: '@alex_neo', ton: 15.5, refs: 12, taps: 845000, status: 'active' },
    { id: '@kander_dev', ton: 50.0, refs: 45, taps: 2100000, status: 'active' },
    { id: '@scam_bot_99', ton: 0.0, refs: 0, taps: 9999999, status: 'banned' },
  ]);

  const [stats, setStats] = useState({
    users: props.data?.totalUsers || users.length,
    wallets: props.data?.active_wallets || 0,
    balance: props.data?.total_balance || 0,
    load: 12.7, lat: 106
  });

  const [history, setHistory] = useState(props.data?.history || []);

  // --- ACTIONS ---
  const toggleBan = (userId) => {
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, status: u.status === 'banned' ? 'active' : 'banned' } : u
    ));
    playSound(400, 'sawtooth');
  };

  const updateUser = (userId, newData) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...newData } : u));
    setEditingUser(null);
    playSound(800);
  };

  const exportToCSV = () => {
    const headers = ['User_ID,TON,Refs,Taps,Status\n'];
    const rows = users.map(u => `${u.id},${u.ton},${u.refs},${u.taps},${u.status}\n`);
    const blob = new Blob([headers, ...rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neural_pulse_snapshot.csv`;
    a.click();
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setBootProgress(p => {
        if (p >= 100) { clearInterval(timer); setTimeout(() => setIsLoaded(true), 300); return 100; }
        return p + 10;
      });
    }, 30);
    
    const es = new EventSource('/api/admin/stream');
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        setStats(p => ({ ...p, users: d.user_count ?? p.users, load: d.server_load ?? p.load, balance: d.total_balance ?? p.balance, lat: d.db_latency ?? p.lat }));
        if (d.time) setHistory(prev => [...prev.slice(-30), d]);
      } catch (err) {}
    };
    return () => { clearInterval(timer); es.close(); };
  }, []);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const filteredUsers = users.filter(u => u.id.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!isLoaded) return (
    <div style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'monospace' }}>
      <div style={{ letterSpacing: '5px', marginBottom: '15px' }}>BOOTING_NEURAL_OS_v9.5</div>
      <div style={{ width: '200px', height: '2px', background: '#111' }}>
        <div style={{ width: `${bootProgress}%`, height: '100%', background: CYBER.primary, boxShadow: `0 0 10px ${CYBER.primary}` }} />
      </div>
    </div>
  );

  return (
    <div className={`app-root ${isEmergency ? 'emergency-mode' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; position: relative; }
        .app-root::after { content: ""; position: fixed; inset: 0; pointer-events: none; opacity: 0.03; z-index: 10; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02)); background-size: 100% 3px, 2px 100%; }

        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; flex-wrap: wrap; gap: 10px; }
        .main-title { font-size: clamp(24px, 8vw, 42px); letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; font-weight: 900; }
        
        .nav-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid ${CYBER.border}; }
        .tab-btn { background: none; border: none; color: #444; cursor: pointer; padding: 10px 15px; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; font-weight: bold; }

        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 2px; position: relative; transition: 0.3s; }
        .stat-label { font-size: 9px; color: ${CYBER.primary}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 5px; }
        .stat-value { font-size: 22px; font-weight: bold; }

        /* Airdrop Manager Styles */
        .search-bar { width: 100%; background: #000; border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; padding: 12px; margin-bottom: 15px; font-family: inherit; }
        .cyber-table-wrap { overflow-x: auto; }
        .cyber-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .cyber-table th { text-align: left; padding: 12px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; text-transform: uppercase; }
        .cyber-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .cyber-table tr:hover { background: rgba(0, 242, 254, 0.03); }

        .action-btn { background: none; border: 1px solid #333; color: #fff; padding: 5px 10px; cursor: pointer; font-size: 10px; margin-right: 5px; }
        .btn-edit { border-color: ${CYBER.warning}; color: ${CYBER.warning}; }
        .btn-ban { border-color: ${CYBER.danger}; color: ${CYBER.danger}; }
        .status-banned { color: ${CYBER.danger}; text-shadow: 0 0 5px ${CYBER.danger}66; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-content { background: #06090d; border: 2px solid ${CYBER.primary}; padding: 25px; width: 100%; max-width: 350px; }
        .modal-input { width: 100%; background: #000; border: 1px solid #333; color: #fff; padding: 10px; margin: 10px 0; }

        .emergency-mode { filter: hue-rotate(-160deg) saturate(1.5); }
      `}</style>

      {/* --- EDIT MODAL --- */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="stat-label">MOD_INTERFACE // {editingUser.id}</div>
            <label style={{fontSize: '10px', marginTop: '10px', display: 'block'}}>SET_TON</label>
            <input className="modal-input" type="number" id="m-ton" defaultValue={editingUser.ton} />
            <label style={{fontSize: '10px', display: 'block'}}>SET_TAPS</label>
            <input className="modal-input" type="number" id="m-taps" defaultValue={editingUser.taps} />
            <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
              <button className="action-btn btn-edit" style={{flex: 1}} onClick={() => updateUser(editingUser.id, {
                ton: parseFloat(document.getElementById('m-ton').value),
                taps: parseInt(document.getElementById('m-taps').value)
              })}>SAVE</button>
              <button className="action-btn" style={{flex: 1}} onClick={() => setEditingUser(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="header">
        <div>
          <h1 className="main-title">NEURAL_PULSE</h1>
          <div style={{ fontSize: '9px', opacity: 0.5 }}>// ACCESS_ROOT // NODE: NL4 // OS: 9.5</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '24px', color: CYBER.ton, fontWeight: '900' }}>{stats.balance.toLocaleString()} $NP</div>
          <div className="stat-label">TOTAL_LIQUIDITY</div>
        </div>
      </div>

      {/* --- TABS --- */}
      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ Overview ]</button>
        <button className={`tab-btn ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ Airdrop_Manager ]</button>
      </div>

      {/* --- CONTENT: OVERVIEW --- */}
      {activeTab === 'overview' && (
        <>
          <div className="stat-grid">
            <div className="card">
              <div className="stat-label">Agents</div>
              <div className="stat-value">{stats.users}U</div>
              <MiniChart data={history.map(h => h.user_count)} color={CYBER.primary} />
            </div>
            <div className="card">
              <div className="stat-label" style={{ color: CYBER.ton }}>TON_Pool</div>
              <div className="stat-value">{users.reduce((acc, u) => acc + u.ton, 0).toFixed(1)}💎</div>
              <MiniChart data={history.map(h => h.total_balance)} color={CYBER.ton} />
            </div>
            <div className="card">
              <div className="stat-label" style={{ color: CYBER.success }}>Kernel_Load</div>
              <div className="stat-value">{stats.load}%</div>
              <MiniChart data={history.map(h => h.server_load)} color={CYBER.success} />
            </div>
            <div className="card">
              <div className="stat-label" style={{ color: CYBER.danger }}>Latency</div>
              <div className="stat-value">{stats.lat}ms</div>
              <MiniChart data={history.map(h => h.db_latency)} color={CYBER.danger} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
            <div className="card">
              <div className="stat-label" style={{ marginBottom: '15px' }}>CORE_OPERATIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className="cyber-btn" onClick={() => playSound(600)}>📢<span>Broadcast</span></button>
                <button className="cyber-btn" onClick={() => playSound(800)}>🧹<span>Purge</span></button>
                <button className="cyber-btn" onClick={() => playSound(400)}>💾<span>Sync</span></button>
                <button className="cyber-btn btn-danger" onClick={() => { setIsEmergency(!isEmergency); playSound(200, 'sawtooth'); }}>
                  ⚠️<span>{isEmergency ? 'Resume' : 'Kill_Switch'}</span>
                </button>
              </div>
              <NeuralWave active={isEmergency} />
            </div>

            <div className="card" style={{ background: 'rgba(0,0,0,0.3)', height: '230px', overflow: 'hidden' }}>
              <div className="stat-label" style={{ marginBottom: '10px' }}>[ LIVE_FEED ]</div>
              <div style={{ fontSize: '10px', height: '180px', overflowY: 'auto', opacity: 0.7 }}>
                {logs.map((l, i) => <div key={i} style={{ marginBottom: '4px' }}>{l}</div>)}
                <div ref={logRef} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- CONTENT: AIRDROP MANAGER --- */}
      {activeTab === 'airdrop' && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '15px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <input 
                className="search-bar" 
                style={{ marginBottom: '0' }}
                placeholder="SEARCH_BY_IDENTITY..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="action-btn" style={{ borderColor: CYBER.success, color: CYBER.success }} onClick={exportToCSV}>EXPORT_CSV</button>
            </div>

            <div className="cyber-table-wrap">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>User_ID</th>
                    <th>TON_In</th>
                    <th>Refs</th>
                    <th>Taps</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={i} style={{ opacity: u.status === 'banned' ? 0.4 : 1 }}>
                      <td style={{ color: CYBER.primary, fontWeight: 'bold' }}>{u.id}</td>
                      <td style={{ color: CYBER.ton }}>{u.ton.toFixed(1)}</td>
                      <td>{u.refs}</td>
                      <td>{(u.taps / 1000).toFixed(1)}k</td>
                      <td className={u.status === 'banned' ? 'status-banned' : ''}>{u.status.toUpperCase()}</td>
                      <td>
                        <button className="action-btn btn-edit" onClick={() => setEditingUser(u)}>⚙️</button>
                        <button className="action-btn btn-ban" onClick={() => toggleBan(u.id)}>{u.status === 'banned' ? '🔓' : '🚫'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ padding: '10px 15px', borderTop: `1px solid ${CYBER.border}`, fontSize: '9px', opacity: 0.3 }}>
            CLUSTER_TRACKING: ACTIVE // SYNC_STAMP: {new Date().toLocaleTimeString()}
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
