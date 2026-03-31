import React, { useState, useEffect, memo, useRef } from 'react';
import { 
  TonConnectUIProvider,
  TonConnectButton, 
  useTonAddress, 
  useTonConnectUI 
} from '@tonconnect/ui-react';

// --- 🌌 NEURAL_PULSE ULTIMATE DARK PALETTE ---
const CYBER = {
  bg: '#000000',         // True Black
  card: '#05070a',       // Deep Navy Black
  primary: '#00f2fe',    // Neon Cyan
  ton: '#0088CC',        // Ton Blue
  success: '#39ff14',    // Neon Green
  danger: '#ff003c',     // Neon Red
  warning: '#ffea00',    // Neon Yellow
  secondary: '#7000ff',  // Purple Pulse
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: '#11151c',
};

// --- 📈 UNIVERSAL SPARKLINE COMPONENT ---
const SparkGraph = memo(({ data, color, height = 35 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * height,
  }));

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '15px', overflow: 'visible', filter: `drop-shadow(0 0 3px ${color}44)` }}>
      <path d={areaPath} fill={`${color}11`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="100" cy={points[points.length-1].y} r="2" fill={color} />
    </svg>
  );
});

// --- 📊 PROGRESS BAR COMPONENT ---
const TelemetryBar = ({ label, value, color }) => (
  <div style={{ flex: 1 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}%</span>
    </div>
    <div style={{ width: '100%', height: '3px', background: '#111', borderRadius: '1px' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, boxShadow: `0 0 8px ${color}55`, transition: 'width 1s ease-in-out' }} />
    </div>
  </div>
);

const DashboardContent = (props) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const userAddress = useTonAddress();
  const logRef = useRef(null);

  const [stats, setStats] = useState({
    cpu: 13, ram: 38, ssd: 22,
    online: 42, liquidity: 1000,
    latency: 95, ton: 65.5
  });

  const [history, setHistory] = useState({
    cpu: [12, 15, 14, 18, 16, 14, 14],
    online: [38, 40, 42, 41, 43, 42, 42],
    ton: [40, 50, 65.5, 65.5, 65.5, 65.5, 65.5],
    liq: [980, 990, 1000, 1000, 1000, 1000, 1000]
  });

  const [logs, setLogs] = useState(['> UPLINK_ESTABLISHED', '> SECURE_ENCRYPTED_SESSION_ACTIVE']);

  useEffect(() => {
    if (userAddress) {
      setLogs(prev => [...prev, `> WALLET_CONNECTED: ${userAddress.slice(0, 4)}...${userAddress.slice(-4)}`]);
    }
  }, [userAddress]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpu: Math.floor(Math.random() * 5 + 12),
        latency: Math.floor(Math.random() * 10 + 90)
      }));
    }, 3000);
    setTimeout(() => setIsLoaded(true), 800);
    return () => clearInterval(interval);
  }, []);

  if (!isLoaded) return <div style={{ background: '#000', height: '100vh' }} />;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'Roboto Mono', monospace; color: ${CYBER.text}; transition: 0.5s; }
        .header { margin-bottom: 30px; border-left: 3px solid ${CYBER.primary}; padding-left: 15px; position: relative; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 18px; margin-bottom: 15px; border-radius: 2px; }
        .label { font-size: 9px; color: ${CYBER.primary}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 18px; font-weight: 800; }
        .val-main { font-size: 32px; font-weight: bold; color: #fff; line-height: 1; }
        .val-unit { font-size: 12px; color: ${CYBER.subtext}; margin-left: 5px; }
        
        .op-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
        .op-btn { background: #fff; color: #000; border: none; padding: 14px; font-size: 11px; font-weight: 800; cursor: pointer; text-transform: uppercase; border-radius: 1px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .op-btn:active { opacity: 0.8; transform: translateY(1px); }
        .op-btn.danger { color: ${CYBER.danger}; }

        .ton-btn-wrapper { position: absolute; top: 0; right: 0; transform: scale(0.85); transform-origin: right top; }
        .emergency { filter: saturate(0) contrast(1.2) brightness(0.8) hue-rotate(-160deg); }
      `}</style>

      {/* --- HEADER --- */}
      <div className="header">
        <h1 style={{ color: CYBER.primary, fontSize: '26px', margin: 0, letterSpacing: '4px', fontWeight: 900 }}>NEURAL_PULSE</h1>
        <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '4px' }}>● UPLINK_ESTABLISHED // NODE: TITAN_01</div>
        <div className="ton-btn-wrapper">
          <TonConnectButton />
        </div>
      </div>

      {/* BLOCK 1: HARDWARE */}
      <div className="card">
        <div className="label">System_Hardware_Telemetry</div>
        <div style={{ display: 'flex', gap: '25px' }}>
          <TelemetryBar label="Kernel" value={stats.cpu} color={CYBER.primary} />
          <TelemetryBar label="Memory" value={stats.ram} color={CYBER.secondary} />
          <TelemetryBar label="SSD" value={stats.ssd} color={CYBER.warning} />
        </div>
      </div>

      {/* STATS GRID */}
      <div style={{ display: grid, gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div className="card">
          <div className="label">Active_Agents</div>
          <div className="val-main">{stats.online}<span className="val-unit">U</span></div>
          <SparkGraph data={history.online} color={CYBER.success} />
        </div>

        <div className="card">
          <div className="label">Ton_Pool</div>
          <div className="val-main">{stats.ton}<span className="val-unit">💎</span></div>
          <SparkGraph data={history.ton} color={CYBER.ton} />
        </div>

        <div className="card">
          <div className="label" style={{ color: CYBER.danger }}>I/O_Latency</div>
          <div className="val-main">{stats.latency}<span className="val-unit">ms</span></div>
          <SparkGraph data={history.cpu} color={CYBER.danger} />
        </div>

        <div className="card">
          <div className="label">Total_Liquidity</div>
          <div className="val-main">{stats.liquidity}<span className="val-unit">$NP</span></div>
          <SparkGraph data={history.liq} color={CYBER.warning} />
        </div>
      </div>

      {/* BLOCK 5: OPERATIONS */}
      <div className="card">
        <div className="label">Core_Operations</div>
        <div className="op-grid">
          <button className="op-btn" onClick={() => setLogs(p => [...p, '> BROADCAST_INITIATED...'])}>📢 Broadcast</button>
          <button className="op-btn" onClick={() => setLogs(p => [...p, '> DATA_PURGE_COMPLETE'])}>🧹 Purge</button>
          <button className="op-btn" onClick={() => setLogs(p => [...p, '> DB_SYNC_SUCCESSFUL'])}>💾 Sync</button>
          <button className="op-btn danger" onClick={() => setIsEmergency(!isEmergency)}>⚠️ Kill_Switch</button>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
        <span style={{ color: CYBER.primary, fontWeight: 'bold' }}>[ LIVE_SYSTEM_FEED ]</span>
        <span style={{ opacity: 0.3 }}>SECURE_SESSION_ACTIVE</span>
      </div>
      <div style={{ height: '60px', overflowY: 'hidden', fontSize: '10px', opacity: 0.4, marginTop: '10px', lineHeight: '1.5' }}>
        {logs.slice(-3).map((l, i) => <div key={i}>{l}</div>)}
        <div>{`> SYSTEM_TICK: ${Math.random().toString(16).slice(2, 8).toUpperCase()}`}</div>
      </div>
    </div>
  );
};

// --- FINAL WRAPPER ---
const Dashboard = (props) => (
  <TonConnectUIProvider manifestUrl="https://np.bothost.tech/tonconnect-manifest.json">
    <DashboardContent {...props} />
  </TonConnectUIProvider>
);

export default Dashboard;
