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

// --- 🔉 QUANTUM AUDIO ENGINE (FIXED) ---
const playSound = (freq, type = 'sine', dur = 0.2) => {
  if (typeof window === 'undefined' || !window.AudioContext) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); 
    gain.connect(ctx.destination);
    osc.start(); 
    osc.stop(ctx.currentTime + dur);
  } catch (e) { /* Silent fail for browser policies */ }
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
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [bootProgress, setBootProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const logRef = useRef(null);

  const userAddress = useTonAddress();
  
  // Статистика
  const [logs, setLogs] = useState(['> MOUNTING_VOLUMES...', '> SYSTEM_READY', `> SYNCING_DATABASE: ${data?.totalUsers || 1250} AGENTS FOUND`]);
  const [stats, setStats] = useState({
    load: data?.currentLoad || 12.4,
    lat: data?.currentLat || 98,
    activeTappers: 52,
    linkedWallets: 842,
    totalTonPool: data?.total_balance || 4520.50,
    tonInflow: 0.45
  });

  const [history, setHistory] = useState({
    load: data?.history?.load || Array(20).fill(10),
    lat: data?.history?.lat || Array(20).fill(100),
    tappers: data?.history?.tappers || Array(20).fill(50),
    tonInflow: data?.history?.tonInflow || Array(20).fill(0.5)
  });

  useEffect(() => {
    setIsMounted(true);
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

  // Real-time loop
  useEffect(() => {
    if (!isLoaded) return;
    const interval = setInterval(() => {
      setStats(prev => {
        const inflow = Math.random() * 1.5;
        const nextLoad = Math.max(5, Math.min(95, prev.load + (Math.random() * 4 - 2)));
        const nextLat = Math.max(40, Math.min(200, prev.lat + (Math.random() * 10 - 5)));
        const nextTappers = Math.max(10, Math.min(300, prev.activeTappers + Math.floor(Math.random() * 6 - 3)));
        
        setHistory(h => ({
          load: [...h.load.slice(-19), nextLoad],
          lat: [...h.lat.slice(-19), nextLat],
          tappers: [...h.tappers.slice(-19), nextTappers],
          tonInflow: [...h.tonInflow.slice(-19), inflow]
        }));

        return { 
          ...prev, 
          load: nextLoad, 
          lat: nextLat, 
          activeTappers: nextTappers, 
          tonInflow: inflow,
          totalTonPool: prev.totalTonPool + (inflow / 100)
        };
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoaded]);

  useEffect(() => {
    if (userAddress) {
      playSound(800, 'sine', 0.1);
      setLogs(prev => [...prev, `> WALLET_BRIDGE_ESTABLISHED: ${userAddress.slice(0, 6)}...`]);
    }
  }, [userAddress]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const handleBroadcast = () => {
    if (!broadcastMsg) return;
    setLogs(prev => [...prev, `> BROADCAST: ${broadcastMsg.toUpperCase()}`]);
    setBroadcastMsg('');
    playSound(1000, 'sine', 0.4);
  };

  if (!isMounted) return null;

  if (!isLoaded) return (
    <div style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'monospace' }}>
      <div style={{ letterSpacing: '5px', fontWeight: 'bold', textShadow: `0 0 10px ${CYBER.primary}` }}>BOOTING_NEURAL_OS_v9.8</div>
      <div style={{ width: '200px', height: '2px', background: '#111', marginTop: '15px', position: 'relative' }}>
        <div style={{ width: `${bootProgress}%`, height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}` }} />
      </div>
    </div>
  );

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; transition: filter 0.5s ease; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
        .label { font-size: 9px; color: ${CYBER.primary}; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.8; }
        .value { font-size: 24px; font-weight: 800; margin-top: 5px; color: #fff; }
        .unit { font-size: 12px; opacity: 0.4; margin-left: 5px; }
        .nav-tabs { display: flex; gap: 20px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #555; padding: 12px 0; font-size: 11px; cursor: pointer; text-transform: uppercase; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }
        .cyber-btn { background: #fff; color: #000; border: none; padding: 10px 15px; font-size: 10px; font-weight: bold; cursor: pointer; border-radius: 2px; }
        .emergency-btn { width: 100%; background: ${CYBER.danger}; color: #fff; border: none; padding: 15px; font-weight: bold; cursor: pointer; margin-top: 10px; border-radius: 4px; }
        .emergency { filter: hue-rotate(-160deg) contrast(1.2); }
        .ton-btn-container { scale: 0.9; transform-origin: right top; }
        .broadcast-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid ${CYBER.border}; color: #fff; padding: 12px; margin-top: 10px; outline: none; border-radius: 4px; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '26px', letterSpacing: '3px', fontWeight: '900' }}>NEURAL_PULSE</h1>
          <div style={{ fontSize: '9px', opacity: 0.5 }}>OS_v9.8 // BOTH_HOST_STABLE</div>
        </div>
        <div style={{ textAlign: 'right' }}>
           <div className="label" style={{ color: CYBER.ton }}>Total_TON_Pool</div>
           <div className="value" style={{ color: CYBER.ton }}>{stats.totalTonPool.toLocaleString('en-US', {minimumFractionDigits: 2})}<span className="unit">💎</span></div>
           <div className="ton-btn-container"><TonConnectButton /></div>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ 01. Overview ]</button>
        <button className={`tab-btn ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ 02. Agent_Manager ]</button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px' }}>
            <div className="card">
              <div className="label">Live_Tappers</div>
              <div className="value">{stats.activeTappers}<span className="unit">⚡</span></div>
              <MiniChart data={history.tappers} color={CYBER.success} />
            </div>
            <div className="card">
              <div className="label">Wallets_Linked</div>
              <div className="value">{stats.linkedWallets}<span className="unit">🔗</span></div>
              <div style={{ fontSize: '9px', marginTop: '10px', color: CYBER.primary }}>
                {((stats.linkedWallets / (data?.totalUsers || 1000)) * 100).toFixed(1)}% of {data?.totalUsers || 1250}
              </div>
            </div>
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="label">Pool_Activity_Inflow</div>
              <div style={{ color: CYBER.success, fontSize: '12px', float: 'right' }}>+{stats.tonInflow.toFixed(4)} TON/sec</div>
              <MiniChart data={history.tonInflow} color={CYBER.ton} height={35} />
            </div>
            <div className="card">
              <div className="label">CPU_Load</div>
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
            <div className="label">Neural_Telemetry_Log</div>
            <div style={{ height: '120px', overflowY: 'auto', fontSize: '10px', opacity: 0.7, marginTop: '10px' }}>
              {logs.map((log, i) => <div key={i} style={{ borderLeft: `2px solid ${CYBER.primary}`, paddingLeft: '10px', marginBottom: '5px' }}>{log}</div>)}
              <div ref={logRef} />
            </div>
          </div>

          <div className="card">
            <div className="label">Global_Neural_Broadcast</div>
            <input className="broadcast-input" placeholder="SEND DATA TO ALL AGENTS..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />
            <button className="cyber-btn" style={{ marginTop: '12px', width: '100%', background: CYBER.primary }} onClick={handleBroadcast}>EXECUTE_BROADCAST</button>
          </div>

          <button className="emergency-btn" onClick={() => setIsEmergency(!isEmergency)}>
            {isEmergency ? 'REBOOT_SYSTEM' : 'INITIALIZE_KILL_SWITCH'}
          </button>
          <NeuralWave active={isEmergency} />
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="label">Identity_Database</div>
          <div style={{ opacity: 0.5, marginTop: '10px' }}>
            {userAddress ? `ACCESS_GRANTED: ${userAddress.slice(0, 12)}...` : '[ MODULE_ENCRYPTED_CONNECT_WALLET ]'}
          </div>
          {userAddress && (
             <div style={{ marginTop: '20px', fontSize: '11px', color: CYBER.primary }}>
                Загрузка списка агентов блокчейна...
             </div>
          )}
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
