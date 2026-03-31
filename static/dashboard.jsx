import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 INFINITY-PULSE CORE PALETTE ---
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
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ transition: 'all 0.5s ease' }} />
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
  const logRef = useRef(null);

  const [wallet, setWallet] = useState({ connected: false, address: null });
  const [logs, setLogs] = useState(['> MOUNTING_VOLUMES...', '> SYSTEM_READY']);
  
  const [users, setUsers] = useState(props.data?.usersList || [
    { id: '@alex_neo', ton: 65.5, taps: 845000, wallet: 'UQ...1', status: 'active' },
    { id: '@kander_dev', ton: 12.0, taps: 2100000, wallet: 'UQ...2', status: 'active' },
    { id: '@guest_01', ton: 0.0, taps: 15000, wallet: null, status: 'active' }
  ]);

  // --- РАСШИРЕННАЯ СТАТИСТИКА ---
  const [stats, setStats] = useState({
    load: 10.7,
    lat: 101,
    ram: 42,
    totalUsers: 1250,
    activeTappers: 48,
    linkedWallets: 842,
    tonInflow: 1.25,
    totalTonPool: 15420.50 // Начальное значение общего пула TON
  });

  const [history, setHistory] = useState({
    load: Array(20).fill(10),
    lat: Array(20).fill(100),
    tappers: Array(20).fill(40),
    tonInflow: Array(20).fill(1)
  });

  // Boot sequence
  useEffect(() => {
    const timer = setInterval(() => {
      setBootProgress(p => {
        if (p >= 100) { clearInterval(timer); setTimeout(() => setIsLoaded(true), 300); return 100; }
        return p + 10;
      });
    }, 30);
    return () => clearInterval(timer);
  }, []);

  // Live telemetry update
  useEffect(() => {
    if (!isLoaded) return;
    const interval = setInterval(() => {
      setStats(prev => {
        const nextLoad = Math.max(5, Math.min(95, prev.load + (Math.random() * 6 - 3)));
        const nextLat = Math.max(40, Math.min(250, prev.lat + (Math.random() * 20 - 10)));
        const nextTappers = Math.max(10, Math.min(200, prev.activeTappers + Math.floor(Math.random() * 10 - 5)));
        const nextInflow = Math.max(0.1, prev.tonInflow + (Math.random() * 0.4 - 0.2));
        
        // Накопление общего пула на основе текущего притока
        const nextTotalPool = prev.totalTonPool + (nextInflow / 10); 

        setHistory(h => ({
          load: [...h.load.slice(-19), nextLoad],
          lat: [...h.lat.slice(-19), nextLat],
          tappers: [...h.tappers.slice(-19), nextTappers],
          tonInflow: [...h.tonInflow.slice(-19), nextInflow]
        }));

        return { 
          ...prev, 
          load: nextLoad, 
          lat: nextLat, 
          activeTappers: nextTappers, 
          tonInflow: nextInflow,
          totalTonPool: nextTotalPool
        };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoaded]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // --- ACTIONS ---
  const connectWallet = () => {
    playSound(800, 'sine', 0.1);
    setWallet({ connected: true, address: 'UQAr...4Xz9' });
    setLogs(prev => [...prev, '> WALLET_CONNECTED: UQAr...4Xz9']);
  };

  const disconnectWallet = () => {
    playSound(300, 'sawtooth', 0.1);
    setWallet({ connected: false, address: null });
    setLogs(prev => [...prev, '> WALLET_DISCONNECTED']);
  };

  const toggleBan = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'banned' ? 'active' : 'banned' } : u));
    playSound(300, 'sawtooth');
    setLogs(prev => [...prev, `> ALERT: USER ${userId} STATUS_CHANGED`]);
  };

  if (!isLoaded) return (
    <div style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'monospace' }}>
      <div style={{ letterSpacing: '5px' }}>BOOTING_NEURAL_OS_v9.6</div>
      <div style={{ width: '200px', height: '2px', background: '#111', marginTop: '15px' }}>
        <div style={{ width: `${bootProgress}%`, height: '100%', background: CYBER.primary }} />
      </div>
    </div>
  );

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; transition: filter 0.5s; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 12px; margin-bottom: 12px; position: relative; }
        .label { font-size: 8px; color: ${CYBER.primary}; text-transform: uppercase; letter-spacing: 1px; }
        .value { font-size: 20px; font-weight: bold; margin-top: 4px; }
        .unit { font-size: 10px; opacity: 0.5; margin-left: 4px; }
        .nav-tabs { display: flex; gap: 15px; margin-bottom: 15px; border-bottom: 1px solid ${CYBER.border}; }
        .tab-btn { background: none; border: none; color: #444; padding: 10px 0; font-size: 10px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }
        .cyber-btn { background: #fff; color: #000; border: none; padding: 12px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase; border-radius: 2px; }
        .emergency-btn { width: 100%; background: ${CYBER.danger}; color: #fff; border: none; padding: 12px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        .emergency { filter: hue-rotate(-160deg); }
        .cyber-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        .cyber-table th { text-align: left; padding: 12px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      `}</style>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '22px', letterSpacing: '2px' }}>NEURAL_PULSE</h1>
          <div style={{ fontSize: '8px', opacity: 0.5 }}>ROOT_ACCESS // OS_9.7</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label" style={{color: CYBER.ton}}>Total_TON_Pool</div>
          <div className="value" style={{ color: CYBER.ton }}>
            {stats.totalTonPool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="unit">💎</span>
          </div>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ Overview ]</button>
        <button className={`tab-btn ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ Airdrop_Manager ]</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="card">
              <div className="label">Active_Tappers</div>
              <div className="value">{stats.activeTappers}<span className="unit">⚡</span></div>
              <MiniChart data={history.tappers} color={CYBER.success} />
            </div>

            <div className="card">
              <div className="label">Wallets_Linked</div>
              <div className="value">{stats.linkedWallets}<span className="unit">🔗</span></div>
              <div style={{ fontSize: '8px', marginTop: '15px', color: CYBER.primary }}>
                {((stats.linkedWallets / stats.totalUsers) * 100).toFixed(1)}% Conversion
              </div>
            </div>

            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="label">TON_Pool_Inflow</div>
                <div style={{ color: CYBER.ton, fontWeight: 'bold' }}>+{stats.tonInflow.toFixed(2)} TON/s</div>
              </div>
              <MiniChart data={history.tonInflow} color={CYBER.ton} height={30} />
            </div>

            <div className="card">
              <div className="label">CPU_Load</div>
              <div className="value">{stats.load.toFixed(1)}%</div>
              <MiniChart data={history.load} color={CYBER.primary} />
            </div>
            <div className="card">
              <div className="label">Net_Latency</div>
              <div className="value">{stats.lat.toFixed(0)}ms</div>
              <MiniChart data={history.lat} color={CYBER.warning} />
            </div>
          </div>

          <div className="card">
            <div className="label">Resource_Monitor</div>
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px' }}>
                <span>RAM_USAGE</span><span>{stats.ram}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: '#111' }}>
                <div style={{ width: `${stats.ram}%`, height: '100%', background: CYBER.primary }} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="label">System_Logs</div>
            <div style={{ height: '80px', overflowY: 'auto', fontSize: '9px', opacity: 0.6, marginTop: '8px' }}>
              {logs.map((log, i) => <div key={i} style={{ borderLeft: `2px solid ${CYBER.primary}`, paddingLeft: '8px', marginBottom: '4px' }}>{log}</div>)}
              <div ref={logRef} />
            </div>
          </div>

          <button className="emergency-btn" onClick={() => setIsEmergency(!isEmergency)}>
            {isEmergency ? 'RESUME_SYSTEM' : 'EMERGENCY_KILL_SWITCH'}
          </button>
          <NeuralWave active={isEmergency} />
        </>
      )}

      {activeTab === 'airdrop' && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="label">Wallet_Bridge</div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '4px' }}>
                  {wallet.connected ? `CONNECTED: ${wallet.address}` : 'STATUS: DISCONNECTED'}
                </div>
              </div>
              <button className="cyber-btn" onClick={wallet.connected ? disconnectWallet : connectWallet}>
                {wallet.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="label">Database_Search</div>
            <input 
              className="search-bar" 
              style={{ width:'100%', background:'#000', border:`1px solid ${CYBER.border}`, color:'#fff', padding:'10px', marginTop:'10px', boxSizing:'border-box', fontFamily:'inherit' }}
              placeholder="Search User ID..." 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
            <div style={{ overflowX: 'auto' }}>
              <table className="cyber-table">
                <thead>
                  <tr><th>Identity</th><th>Taps</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {users.filter(u => u.id.toLowerCase().includes(searchTerm.toLowerCase())).map((u, i) => (
                    <tr key={i} style={{ opacity: u.status === 'banned' ? 0.3 : 1 }}>
                      <td style={{ color: CYBER.primary }}>{u.id}</td>
                      <td>{(u.taps / 1000).toFixed(1)}k</td>
                      <td>{u.status}</td>
                      <td>
                        <button className="cyber-btn" style={{ padding: '4px 8px', fontSize: '8px' }} onClick={() => toggleBan(u.id)}>
                          {u.status === 'banned' ? 'Unlock' : 'Ban'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <footer style={{ textAlign: 'center', fontSize: '8px', opacity: 0.2, marginTop: '20px', letterSpacing: '4px' }}>
        PROPERTY_OF_NEURAL_PULSE_NETWORK // 2026
      </footer>
    </div>
  );
};

export default Dashboard;
