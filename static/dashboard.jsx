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
  const { data } = props; // Данные, передаваемые из AdminJS handler
  const [activeTab, setActiveTab] = useState('overview');
  const [bootProgress, setBootProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const logRef = useRef(null);

  const userAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  const [logs, setLogs] = useState(['> MOUNTING_VOLUMES...', '> SYSTEM_READY', `> SYNCING_DATABASE: ${data?.totalUsers || 0} AGENTS FOUND`]);
  const [users, setUsers] = useState(data?.usersList || []);
  const [stats, setStats] = useState({
    load: data?.currentLoad || 0,
    lat: data?.currentLat || 0,
    ram: data?.ramUsage || 0,
    totalUsers: data?.totalUsers || 0,
    totalTonPool: data?.total_balance || 0 
  });

  const [history, setHistory] = useState({
    load: data?.history?.load || Array(20).fill(0),
    lat: data?.history?.lat || Array(20).fill(0),
    tappers: data?.history?.tappers || Array(20).fill(0),
    inflow: data?.history?.inflow || Array(20).fill(0)
  });

  // --- 🛰️ REAL-TIME SSE INTEGRATION ---
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
            load: [...prev.load.slice(1), update.server_load],
            lat: [...prev.lat.slice(1), update.db_latency],
            tappers: [...prev.tappers.slice(1), update.user_count],
            inflow: [...prev.inflow.slice(1), update.active_wallets || 0]
          }));
        }
        if (update.recent_event) {
          setLogs(prev => [...prev.slice(-15), `> ${update.recent_event}`]);
        }
      } catch (err) { console.error("Stream parsing error", err); }
    };
    return () => eventSource.close();
  }, []);

  // Boot sequence simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setBootProgress(p => {
        if (p >= 100) { 
          clearInterval(timer); 
          setTimeout(() => setIsLoaded(true), 300); 
          return 100; 
        }
        return p + 10;
      });
    }, 40);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (userAddress) {
      playSound(800, 'sine', 0.1);
      setLogs(prev => [...prev, `> WALLET_BRIDGE_ESTABLISHED: ${userAddress.slice(0, 6)}...`]);
    }
  }, [userAddress]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const toggleBan = async (userId) => {
    try {
      await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_ban', userId })
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'banned' ? 'active' : 'banned' } : u));
      playSound(400, 'sawtooth');
      setLogs(prev => [...prev, `> CMD_EXEC: TOGGLE_BAN ID_${userId}`]);
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
      setLogs(prev => [...prev, '> BROADCAST_SEQUENCE_INITIATED']);
      playSound(1000, 'sine', 0.4);
    } catch (e) { console.error(e); }
  };

  if (!isLoaded) return (
    <div style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'monospace' }}>
      <div style={{ letterSpacing: '5px', fontWeight: 'bold', textShadow: `0 0 10px ${CYBER.primary}` }}>BOOTING_NEURAL_OS_v9.7</div>
      <div style={{ width: '200px', height: '2px', background: '#111', marginTop: '15px', position: 'relative' }}>
        <div style={{ width: `${bootProgress}%`, height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}` }} />
      </div>
    </div>
  );

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; transition: filter 0.5s ease; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; margin-bottom: 15px; border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .label { font-size: 9px; color: ${CYBER.primary}; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.8; }
        .value { font-size: 24px; font-weight: 800; margin-top: 5px; color: #fff; }
        .unit { font-size: 12px; opacity: 0.4; margin-left: 5px; }
        .nav-tabs { display: flex; gap: 20px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #555; padding: 12px 0; font-size: 11px; cursor: pointer; text-transform: uppercase; transition: 0.3s; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; text-shadow: 0 0 8px ${CYBER.primary}; }
        .cyber-btn { background: #fff; color: #000; border: none; padding: 10px 15px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase; border-radius: 2px; }
        .emergency-btn { width: 100%; background: ${CYBER.danger}; color: #fff; border: none; padding: 15px; font-weight: bold; cursor: pointer; margin-top: 10px; border-radius: 4px; letter-spacing: 2px; }
        .emergency { filter: hue-rotate(-160deg) contrast(1.2); }
        .cyber-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
        .cyber-table th { text-align: left; padding: 12px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; font-size: 10px; }
        .cyber-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .ton-btn-container { scale: 0.9; transform-origin: right top; }
        .broadcast-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid ${CYBER.border}; color: #fff; padding: 12px; margin-top: 10px; font-family: inherit; outline: none; border-radius: 4px; }
        .search-bar { width: 100%; background: rgba(0,0,0,0.5); border: 1px solid ${CYBER.border}; color: #fff; padding: 12px; box-sizing: border-box; outline: none; border-radius: 4px; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '26px', letterSpacing: '3px', fontWeight: '900' }}>NEURAL_PULSE</h1>
          <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '4px' }}>CORE_OS_v9.7 // BOTH_HOST_STABLE</div>
        </div>
        <div className="ton-btn-container">
          <TonConnectButton />
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ 01. Overview ]</button>
        <button className={`tab-btn ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ 02. Agent_Manager ]</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px' }}>
            <div className="card">
              <div className="label">Total_Agents</div>
              <div className="value">{stats.totalUsers}<span className="unit">UNIT</span></div>
              <MiniChart data={history.tappers} color={CYBER.success} />
            </div>
            <div className="card" style={{ borderLeft: `3px solid ${CYBER.ton}` }}>
              <div className="label" style={{ color: CYBER.ton }}>TON_Pool_Status</div>
              <div className="value">{Number(stats.totalTonPool).toLocaleString()}<span className="unit">💎</span></div>
              <MiniChart data={history.inflow} color={CYBER.ton} />
            </div>
            <div className="card">
              <div className="label">Node_Load</div>
              <div className="value">{Number(stats.load).toFixed(1)}%</div>
              <MiniChart data={history.load} color={CYBER.primary} />
            </div>
            <div className="card">
              <div className="label">Latency</div>
              <div className="value">{Number(stats.lat).toFixed(0)}ms</div>
              <MiniChart data={history.lat} color={CYBER.warning} />
            </div>
          </div>

          <div className="card">
            <div className="label">Neural_Telemetry_Log</div>
            <div style={{ height: '140px', overflowY: 'auto', fontSize: '10px', opacity: 0.7, marginTop: '10px', fontFamily: 'monospace', lineHeight: '1.6' }}>
              {logs.map((log, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${CYBER.primary}`, paddingLeft: '10px', marginBottom: '5px', background: 'rgba(255,255,255,0.02)' }}>
                  {log}
                </div>
              ))}
              <div ref={logRef} />
            </div>
          </div>

          <div className="card">
            <div className="label">Global_Neural_Broadcast</div>
            <input className="broadcast-input" placeholder="SEND DATA TO ALL ACTIVE AGENTS..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />
            <button className="cyber-btn" style={{ marginTop: '12px', width: '100%', background: CYBER.primary, color: '#000' }} onClick={handleBroadcast}>
              Execute_Broadcast_Sequence
            </button>
          </div>

          <button className="emergency-btn" onClick={() => setIsEmergency(!isEmergency)}>
            {isEmergency ? 'DEACTIVATE_SAFE_MODE' : 'INITIALIZE_KILL_SWITCH'}
          </button>
          <NeuralWave active={isEmergency} />
        </>
      )}

      {activeTab === 'airdrop' && (
        <div className="card">
          <div className="label">Identity_Database_Search</div>
          <div style={{ marginTop: '15px' }}>
            <input className="search-bar" placeholder="FILTER_BY_UID_OR_ALIAS..." onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="cyber-table">
              <thead>
                <tr><th>Identity_UID</th><th>Pulse_Balance</th><th>Net_Status</th><th>Control</th></tr>
              </thead>
              <tbody>
                {users.filter(u => String(u.id).includes(searchTerm) || String(u.username).toLowerCase().includes(searchTerm.toLowerCase())).map((u, i) => (
                  <tr key={i} style={{ opacity: u.status === 'banned' ? 0.3 : 1, transition: '0.3s' }}>
                    <td style={{ color: CYBER.primary, fontWeight: 'bold' }}>{u.username || u.id}</td>
                    <td>{Number(u.balance || 0).toLocaleString()} <span style={{fontSize:'9px', opacity:0.4}}>PULSE</span></td>
                    <td style={{ color: u.status === 'banned' ? CYBER.danger : CYBER.success }}>{u.status || 'ACTIVE'}</td>
                    <td>
                      <button className="cyber-btn" onClick={() => toggleBan(u.id)} style={{ padding: '5px 10px', fontSize: '9px' }}>
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
