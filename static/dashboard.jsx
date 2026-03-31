import React, { useState, useEffect, memo, useRef } from 'react';
import { 
  TonConnectUIProvider,
  TonConnectButton, 
  useTonAddress, 
  useTonConnectUI 
} from '@tonconnect/ui-react';

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

const DashboardContent = (props) => {
  const { data } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [bootProgress, setBootProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const logRef = useRef(null);

  const userAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  const [logs, setLogs] = useState(['> MOUNTING_VOLUMES...', '> SYSTEM_READY', `> SYNCING_DATABASE: ${data?.totalUsers || 0} AGENTS FOUND`]);
  const [users, setUsers] = useState(data?.usersList || []);

  const [stats, setStats] = useState({
    load: data?.currentLoad || 10.7,
    lat: data?.currentLat || 101,
    ram: data?.ramUsage || 42,
    totalUsers: data?.totalUsers || 0,
    tonInflow: data?.tonInflow || 0,
    totalTonPool: data?.total_balance || 0 
  });

  const history = {
    load: data?.history?.load || Array(20).fill(10),
    lat: data?.history?.lat || Array(20).fill(100),
    tappers: data?.history?.tappers || Array(20).fill(0),
    tonInflow: data?.history?.inflow || Array(20).fill(0)
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setBootProgress(p => {
        if (p >= 100) { clearInterval(timer); setTimeout(() => setIsLoaded(true), 300); return 100; }
        return p + 10;
      });
    }, 30);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (userAddress) {
      playSound(800, 'sine', 0.1);
      setLogs(prev => [...prev, `> WALLET_BRIDGE_ESTABLISHED: ${userAddress.slice(0, 4)}...${userAddress.slice(-4)}`]);
    } else if (isLoaded) {
      setLogs(prev => [...prev, '> WALLET_BRIDGE_DISCONNECTED']);
    }
  }, [userAddress, isLoaded]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const toggleBan = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'banned' ? 'active' : 'banned' } : u));
    playSound(300, 'sawtooth');
    setLogs(prev => [...prev, `> ALERT: USER ${userId} STATUS_UPDATED`]);
  };

  const handleTestPayment = async () => {
    const tx = {
      validUntil: Math.floor(Date.now() / 1000) + 60,
      messages: [{ address: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c", amount: "10000000" }]
    };
    try {
      await tonConnectUI.sendTransaction(tx);
      setLogs(prev => [...prev, '> TX_STATUS: SUCCESSFUL_VALIDATION']);
    } catch (e) {
      setLogs(prev => [...prev, '> TX_STATUS: REJECTED_BY_USER']);
    }
  };

  if (!isLoaded) return (
    <div style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'monospace' }}>
      <div style={{ letterSpacing: '5px' }}>BOOTING_NEURAL_OS_v9.7</div>
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
        .cyber-btn { background: #fff; color: #000; border: none; padding: 8px 12px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase; border-radius: 2px; }
        .emergency-btn { width: 100%; background: ${CYBER.danger}; color: #fff; border: none; padding: 12px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        .emergency { filter: hue-rotate(-160deg); }
        .cyber-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        .cyber-table th { text-align: left; padding: 12px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .ton-btn-container { scale: 0.8; transform-origin: right; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '22px', letterSpacing: '2px' }}>NEURAL_PULSE</h1>
          <div style={{ fontSize: '8px', opacity: 0.5 }}>OS_9.7 // WEB3_READY</div>
        </div>
        <div className="ton-btn-container">
          <TonConnectButton />
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ Overview ]</button>
        <button className={`tab-btn ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ Agent_Manager ]</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="card">
              <div className="label">Total_Agents</div>
              <div className="value">{stats.totalUsers}<span className="unit">👤</span></div>
              <MiniChart data={history.tappers} color={CYBER.success} />
            </div>
            <div className="card">
              <div className="label" style={{ color: CYBER.ton }}>TON_Pool_Status</div>
              <div className="value" style={{ color: CYBER.ton }}>{Number(stats.totalTonPool).toLocaleString()}<span className="unit">💎</span></div>
              <MiniChart data={history.tonInflow} color={CYBER.ton} />
            </div>
            <div className="card">
              <div className="label">Server_Load</div>
              <div className="value">{stats.load.toFixed(1)}%</div>
              <MiniChart data={history.load} color={CYBER.primary} />
            </div>
            <div className="card">
              <div className="label">Latency</div>
              <div className="value">{stats.lat.toFixed(0)}ms</div>
              <MiniChart data={history.lat} color={CYBER.warning} />
            </div>
          </div>

          <div className="card">
            <div className="label">System_Logs</div>
            <div style={{ height: '100px', overflowY: 'auto', fontSize: '9px', opacity: 0.6, marginTop: '8px', fontFamily: 'monospace' }}>
              {logs.map((log, i) => <div key={i} style={{ borderLeft: `2px solid ${CYBER.primary}`, paddingLeft: '8px', marginBottom: '4px' }}>{log}</div>)}
              <div ref={logRef} />
            </div>
          </div>

          <button className="emergency-btn" onClick={() => setIsEmergency(!isEmergency)}>
            {isEmergency ? 'DEACTIVATE_SAFE_MODE' : 'EMERGENCY_KILL_SWITCH'}
          </button>
          <NeuralWave active={isEmergency} />
        </>
      )}

      {activeTab === 'airdrop' && (
        <>
          <div className="card">
            <div className="label">Wallet_Control_Center</div>
            <div style={{ marginTop: '8px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{userAddress ? `▣ LINKED: ${userAddress.slice(0, 12)}...` : '□ OFFLINE: RE-AUTHENTICATION REQUIRED'}</span>
              {userAddress && <button className="cyber-btn" onClick={handleTestPayment}>Test_TX</button>}
            </div>
          </div>

          <div className="card">
            <div className="label">Agent_Search</div>
            <input className="search-bar" style={{ width:'100%', background:'#000', border:`1px solid ${CYBER.border}`, color:'#fff', padding:'10px', marginTop:'10px', boxSizing:'border-box', outline: 'none' }} placeholder="Search by ID/Username..." onChange={(e) => setSearchTerm(e.target.value)} />
            <div style={{ overflowX: 'auto' }}>
              <table className="cyber-table">
                <thead>
                  <tr><th>Identity</th><th>Balance</th><th>Status</th><th>Control</th></tr>
                </thead>
                <tbody>
                  {users.filter(u => String(u.id).includes(searchTerm) || String(u.username).toLowerCase().includes(searchTerm.toLowerCase())).map((u, i) => (
                    <tr key={i} style={{ opacity: u.status === 'banned' ? 0.3 : 1 }}>
                      <td style={{ color: CYBER.primary }}>{u.username || u.id}</td>
                      <td>{Number(u.balance || u.taps).toLocaleString()}</td>
                      <td>{u.status || 'active'}</td>
                      <td><button className="cyber-btn" onClick={() => toggleBan(u.id)}>{u.status === 'banned' ? 'Unlock' : 'Ban'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// --- WRAPPER WITH PROVIDER ---
const Dashboard = (props) => {
  return (
    <TonConnectUIProvider manifestUrl="https://np.bothost.tech/tonconnect-manifest.json">
      <DashboardContent {...props} />
    </TonConnectUIProvider>
  );
};

export default Dashboard;
