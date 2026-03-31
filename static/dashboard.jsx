import React, { useState, useEffect, memo, useRef } from 'react';

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
      <path 
        d={pathData} 
        fill="none" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        style={{ transition: 'all 0.5s ease' }}
      />
      <path 
        d={`${pathData} L 100,${height} L 0,${height} Z`} 
        fill={color} 
        fillOpacity="0.1" 
      />
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

  // --- WALLET & ASSET STATE ---
  const [wallet, setWallet] = useState({ connected: false, address: null });
  const [selectedAsset, setSelectedAsset] = useState({ symbol: 'TON', balance: 1250.0, color: CYBER.ton });
  const [assets] = useState([
    { symbol: 'TON', balance: 1250.0, color: CYBER.ton },
    { symbol: '$NP', balance: 500000, color: CYBER.primary },
    { symbol: 'USDT', balance: 450.25, color: CYBER.success }
  ]);
  
  const [logs, setLogs] = useState(['> MOUNTING_VOLUMES...', '> SYSTEM_READY']);
  const [users, setUsers] = useState(props.data?.usersList || [
    { id: '@alex_neo', ton: 65.5, refs: 12, taps: 845000, status: 'active' },
    { id: '@kander_dev', ton: 12.0, refs: 45, taps: 2100000, status: 'active' },
    { id: '@guest_01', ton: 0.0, refs: 2, taps: 15000, status: 'active' }
  ]);

  // --- DYNAMIC STATS & HISTORY ---
  const [stats, setStats] = useState({ load: 0, lat: 0, ram: 42, disk: 18 });
  const [history, setHistory] = useState({
    load: Array(20).fill(10),
    lat: Array(20).fill(100)
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
        const nextLoad = Math.max(5, Math.min(95, (prev.load || 10) + (Math.random() * 6 - 3)));
        const nextLat = Math.max(40, Math.min(250, (prev.lat || 100) + (Math.random() * 20 - 10)));
        
        setHistory(h => ({
          load: [...h.load.slice(-19), nextLoad],
          lat: [...h.lat.slice(-19), nextLat]
        }));
        
        return { ...prev, load: nextLoad, lat: nextLat };
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

  const runAirdrop = () => {
    if (!wallet.connected) {
      playSound(200, 'square', 0.3);
      setLogs(prev => [...prev, '> ERROR: WALLET_NOT_CONNECTED']);
      return;
    }
    let count = 0;
    setUsers(prev => prev.map(u => {
      if (u.status === 'banned') return u;
      count++;
      return { ...u, ton: u.ton + 1 }; 
    }));
    playSound(900, 'sine', 0.3);
    setLogs(prev => [...prev, `> AIRDROP: DISTRIBUTED ${selectedAsset.symbol} TO ${count} AGENTS`]);
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
    <div className={`app-root ${isEmergency ? 'emergency-mode' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; position: relative; transition: filter 0.5s; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 2px; margin-bottom: 15px; position: relative; }
        .nav-tabs { display: flex; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid ${CYBER.border}; }
        .tab-btn { background: none; border: none; color: #444; cursor: pointer; padding: 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }
        .cyber-btn { background: #fff; color: #000; border: none; padding: 12px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase; border-radius: 2px; transition: 0.2s; }
        .cyber-btn:active { transform: scale(0.96); }
        .btn-outline { background: transparent; border: 1px solid ${CYBER.primary}; color: ${CYBER.primary}; }
        .btn-danger { background: ${CYBER.danger}; color: #fff; }
        .asset-chip { padding: 10px; border: 1px solid #222; font-size: 10px; cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between; align-items: center; }
        .asset-chip.selected { border-color: ${CYBER.primary}; background: rgba(0, 242, 254, 0.05); }
        .search-bar { width: 100%; background: #000; border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; padding: 12px; margin-bottom: 15px; font-family: inherit; box-sizing: border-box; }
        .cyber-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .cyber-table th { text-align: left; padding: 12px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .emergency-mode { filter: hue-rotate(-160deg) saturate(1.2); }
      `}</style>

      {/* --- HEADER --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', letterSpacing: '4px', color: CYBER.primary, margin: 0 }}>NEURAL_PULSE</h1>
        <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9px', color: CYBER.primary }}>{selectedAsset.symbol}_BALANCE</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: selectedAsset.color }}>{selectedAsset.balance}</div>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ Overview ]</button>
        <button className={`tab-btn ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ Airdrop_Manager ]</button>
      </div>

      {activeTab === 'overview' && (
         <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
            <div className="card">
              <div style={{ fontSize: '9px', color: CYBER.primary }}>CPU_LOAD</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{stats.load.toFixed(1)}%</div>
              <MiniChart data={history.load} color={CYBER.success} />
            </div>
            <div className="card">
              <div style={{ fontSize: '9px', color: CYBER.primary }}>NET_LATENCY</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{stats.lat.toFixed(0)}ms</div>
              <MiniChart data={history.lat} color={CYBER.warning} />
            </div>
            <div className="card">
              <div style={{ fontSize: '9px', color: CYBER.primary }}>RAM_USAGE</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{stats.ram}%</div>
              <div style={{ width: '100%', height: '4px', background: '#111', marginTop: '10px' }}>
                <div style={{ width: `${stats.ram}%`, height: '100%', background: CYBER.primary }} />
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: '9px', color: CYBER.primary }}>DISK_SPACE</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{stats.disk}%</div>
              <div style={{ width: '100%', height: '4px', background: '#111', marginTop: '10px' }}>
                <div style={{ width: `${stats.disk}%`, height: '100%', background: CYBER.warning }} />
              </div>
            </div>
          </div>
          
          <div className="card">
            <div style={{ fontSize: '9px', color: CYBER.primary, marginBottom: '10px' }}>SYSTEM_LOGS</div>
            <div style={{ height: '120px', overflowY: 'auto', fontSize: '10px', opacity: 0.6 }}>
                {logs.map((log, i) => <div key={i} style={{ marginBottom: '4px', borderLeft: `2px solid ${CYBER.primary}`, paddingLeft: '8px' }}>{log}</div>)}
                <div ref={logRef} />
            </div>
          </div>

          <button className="cyber-btn btn-danger" style={{ width: '100%' }} onClick={() => setIsEmergency(!isEmergency)}>
            {isEmergency ? 'RESUME_NORMAL_OPS' : 'EMERGENCY_KILL_SWITCH'}
          </button>
          <NeuralWave active={isEmergency} />
         </>
      )}

      {activeTab === 'airdrop' && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                <div style={{ fontSize: '8px', color: CYBER.primary }}>WALLET_BRIDGE</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px' }}>
                  {wallet.connected ? `CONNECTED: ${wallet.address}` : 'STATUS: DISCONNECTED'}
                </div>
              </div>
              <button className={`cyber-btn ${wallet.connected ? 'btn-danger' : ''}`} onClick={wallet.connected ? disconnectWallet : connectWallet}>
                {wallet.connected ? 'Disconnect' : 'Connect Wallet'}
              </button>
            </div>

            {wallet.connected && (
              <>
                <div style={{ fontSize: '9px', color: CYBER.primary, marginBottom: '10px' }}>SELECT_ASSET:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '15px' }}>
                  {assets.map(asset => (
                    <div 
                      key={asset.symbol} 
                      className={`asset-chip ${selectedAsset.symbol === asset.symbol ? 'selected' : ''}`}
                      onClick={() => { setSelectedAsset(asset); playSound(600, 'sine', 0.05); }}
                    >
                      <span style={{ fontWeight: 'bold' }}>{asset.symbol}</span>
                      <span style={{ opacity: 0.6 }}>{asset.balance}</span>
                    </div>
                  ))}
                </div>
                <button className="cyber-btn" style={{ width: '100%', background: selectedAsset.color }} onClick={runAirdrop}>
                  🚀 Launch {selectedAsset.symbol} Airdrop
                </button>
              </>
            )}
          </div>

          <div className="card">
            <input className="search-bar" placeholder="SEARCH_AGENT_ID..." onChange={(e) => setSearchTerm(e.target.value)} />
            <div style={{ overflowX: 'auto' }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Identity</th>
                    <th>Taps</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.id.toLowerCase().includes(searchTerm.toLowerCase())).map((u, i) => (
                    <tr key={i} style={{ opacity: u.status === 'banned' ? 0.3 : 1 }}>
                      <td style={{ color: CYBER.primary }}>{u.id}</td>
                      <td>{(u.taps / 1000).toFixed(1)}k</td>
                      <td>
                        <button className="cyber-btn btn-outline" style={{ padding: '4px 8px', fontSize: '8px' }} onClick={() => toggleBan(u.id)}>
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
