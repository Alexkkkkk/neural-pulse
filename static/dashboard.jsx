import React, { useState, useEffect, memo, useRef } from 'react';

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

// --- 📈 DYNAMIC SPARKLINE COMPONENT (AS PER SCREENSHOT) ---
const SparkGraph = memo(({ data, color, height = 45 }) => {
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
    <svg width="100%" height={height} style={{ marginTop: '12px', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#','')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="100" cy={points[points.length-1].y} r="3" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
    </svg>
  );
});

// --- 📊 PROGRESS BAR COMPONENT ---
const TelemetryBar = ({ label, value, color }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}%</span>
    </div>
    <div style={{ width: '100%', height: '3px', background: '#111', borderRadius: '1px' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, boxShadow: `0 0 8px ${color}55`, transition: 'width 1s ease-in-out' }} />
    </div>
  </div>
);

// --- 🗳️ UNIFIED DATA CARD ---
const DataCard = ({ label, value, unit, data, color }) => (
  <div className="card">
    <div className="label" style={{ color: color }}>{label}</div>
    <div className="val-main">
      {value}<span className="val-unit">{unit}</span>
    </div>
    <SparkGraph data={data} color={color} />
  </div>
);

const Dashboard = (props) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const logRef = useRef(null);

  // --- LIVE MONITORING STATES ---
  const [stats, setStats] = useState({
    cpu: 10.7, ram: 38, ssd: 22,
    online: 42, liquidity: 1000,
    latency: 95, ton: 65.5
  });

  // History for all graphs
  const [history, setHistory] = useState({
    cpu: [12, 15, 14, 18, 16, 14, 10.7],
    ram: [35, 36, 38, 38, 37, 38, 38],
    online: [20, 45, 30, 40, 50, 35, 42],
    wallets: [40, 50, 65.5, 65.5, 65.5, 65.5, 65.5],
    liq: [800, 800, 800, 800, 800, 950, 1000],
    lat: [80, 110, 95, 85, 80, 85, 95]
  });

  const [logs, setLogs] = useState(['> UPLINK_ESTABLISHED', '> SECURE_ENCRYPTED_SESSION_ACTIVE']);

  useEffect(() => {
    const interval = setInterval(() => {
      const newCpu = (Math.random() * 5 + 10).toFixed(1);
      const newLat = Math.floor(Math.random() * 15 + 90);
      const newOnline = Math.floor(Math.random() * 5 + 40);
      
      setStats(prev => ({
        ...prev,
        cpu: parseFloat(newCpu),
        latency: newLat,
        online: newOnline
      }));

      setHistory(prev => ({
        cpu: [...prev.cpu.slice(1), parseFloat(newCpu)],
        ram: [...prev.ram.slice(1), 38 + (Math.random() > 0.5 ? 1 : 0)],
        online: [...prev.online.slice(1), newOnline],
        wallets: [...prev.wallets.slice(1), 65.5],
        liq: [...prev.liq.slice(1), prev.liq[6] + (Math.random() > 0.7 ? 10 : 0)],
        lat: [...prev.lat.slice(1), newLat]
      }));
    }, 3000);

    setTimeout(() => setIsLoaded(true), 800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  if (!isLoaded) return <div style={{ background: '#000', height: '100vh' }} />;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />
      
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'Roboto Mono', monospace; color: ${CYBER.text}; transition: 0.5s; }
        .header { margin-bottom: 25px; border-left: 3px solid ${CYBER.primary}; padding-left: 15px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 4px; position: relative; overflow: hidden; }
        
        .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; font-weight: bold; }
        .val-main { font-size: 28px; font-weight: bold; color: #fff; display: flex; align-items: baseline; line-height: 1; }
        .val-unit { font-size: 10px; color: ${CYBER.subtext}; margin-left: 6px; text-transform: uppercase; }

        .op-btn { background: #fff; color: #000; border: none; padding: 12px; font-size: 10px; font-weight: 700; cursor: pointer; text-transform: uppercase; border-radius: 2px; transition: 0.2s; }
        .op-btn:active { background: ${CYBER.primary}; transform: translateY(1px); }
        
        .emergency { filter: saturate(0) contrast(1.5) brightness(0.8) hue-rotate(-160deg); }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: ${CYBER.primary}44; }
      `}</style>

      {/* --- HEADER --- */}
      <div className="header">
        <h1 style={{ color: CYBER.primary, fontSize: '22px', margin: 0, letterSpacing: '4px' }}>NEURAL_PULSE</h1>
        <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '4px' }}>
          <span style={{ color: CYBER.success }}>●</span> UPLINK_ESTABLISHED // NODE: TITAN_01
        </div>
      </div>

      <div className="grid">
        {/* HARDWARE TELEMETRY */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label" style={{ color: CYBER.primary }}>System_Hardware_Telemetry</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '10px' }}>
            <TelemetryBar label="Kernel" value={stats.cpu} color={CYBER.primary} />
            <TelemetryBar label="Memory" value={stats.ram} color={CYBER.secondary} />
            <TelemetryBar label="SSD" value={stats.ssd} color={CYBER.warning} />
          </div>
        </div>

        {/* ACTIVE AGENTS */}
        <DataCard 
          label="Active_Agents" 
          value={stats.online} 
          unit="U" 
          data={history.online} 
          color={CYBER.success} 
        />

        {/* TON POOL */}
        <DataCard 
          label="Ton_Pool" 
          value={stats.ton} 
          unit="💎" 
          data={history.wallets} 
          color={CYBER.ton} 
        />

        {/* I/O LATENCY */}
        <DataCard 
          label="I/O_Latency" 
          value={stats.latency} 
          unit="ms" 
          data={history.lat} 
          color={CYBER.danger} 
        />

        {/* TOTAL LIQUIDITY */}
        <DataCard 
          label="Total_Liquidity" 
          value={stats.liquidity} 
          unit="$NP" 
          data={history.liq} 
          color={CYBER.warning} 
        />

        {/* OPERATIONS CONTROL */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label" style={{ color: CYBER.primary }}>Core_Operations</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button className="op-btn" onClick={() => setLogs(p => [...p, `> BROADCAST_SENT: ${new Date().toLocaleTimeString()}`])}>📢 Broadcast</button>
            <button className="op-btn" onClick={() => setLogs(p => [...p, `> CACHE_PURGED: OK`])}>🧹 Purge</button>
            <button className="op-btn" onClick={() => setLogs(p => [...p, `> DB_SYNC: COMPLETE`])}>💾 Sync</button>
            <button className="op-btn" style={{ background: isEmergency ? CYBER.danger : '#fff', color: isEmergency ? '#fff' : '#000' }} onClick={() => setIsEmergency(!isEmergency)}>⚠️ Kill_Switch</button>
          </div>
        </div>
      </div>

      {/* FOOTER: LIVE FEED */}
      <footer style={{ marginTop: '20px', borderTop: `1px solid ${CYBER.border}`, paddingTop: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '10px' }}>
          <span style={{ color: CYBER.primary }}>[ LIVE_SYSTEM_FEED ]</span>
          <span style={{ opacity: 0.3 }}>SECURE_SESSION_ACTIVE</span>
        </div>
        <div ref={logRef} style={{ height: '70px', overflowY: 'auto', fontSize: '10px', opacity: 0.4, lineHeight: '1.6' }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
          <div>{`> MONITORING_UPDATE: DELTA_${Math.floor(Math.random()*9999)}`}</div>
          <div>{`> ANALYZING_NETWORK_TRAFFIC... STATUS_OK`}</div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
