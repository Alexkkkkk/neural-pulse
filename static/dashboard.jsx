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

// --- 📈 UNIVERSAL SPARKLINE COMPONENT ---
const SparkGraph = memo(({ data, color, height = 35 }) => {
  if (!data || data.length < 2) return null;
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
    <svg width="100%" height={height} style={{ marginTop: '8px', overflow: 'visible', filter: `drop-shadow(0 0 3px ${color}44)` }}>
      <path d={areaPath} fill={`${color}11`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="100" cy={points[points.length-1].y} r="2" fill={color} />
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

const Dashboard = (props) => {
  const { data } = props;
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const logRef = useRef(null);

  // --- LIVE MONITORING STATES ---
  const [stats, setStats] = useState({
    cpu: 18, ram: 42, ssd: 28,
    online: 45, liquidity: 1250,
    latency: 38
  });

  // History for graphs
  const [history, setHistory] = useState({
    kernel: [30, 35, 32, 40, 38, 45, 42],
    network: [40, 42, 41, 45, 44, 46, 45],
    wallets: [800, 810, 805, 820, 825, 840, 850],
    liq: [1200, 1210, 1205, 1230, 1240, 1250, 1250]
  });

  const [logs, setLogs] = useState(['> SYSTEM_BOOT_SEQUENCE_COMPLETE', '> ENCRYPTED_LINK_ESTABLISHED']);

  useEffect(() => {
    const interval = setInterval(() => {
      // Симуляция динамики данных
      const newCpu = Math.floor(Math.random() * 15 + 10);
      const newOnline = Math.floor(Math.random() * 10 + 40);
      
      setStats(prev => ({
        ...prev,
        cpu: newCpu,
        online: newOnline,
        latency: Math.floor(Math.random() * 20 + 30)
      }));

      setHistory(prev => ({
        kernel: [...prev.kernel.slice(1), newCpu + 20],
        network: [...prev.network.slice(1), newOnline],
        wallets: [...prev.wallets.slice(1), prev.wallets[6] + Math.floor(Math.random() * 2)],
        liq: [...prev.liq.slice(1), prev.liq[6] + (Math.random() * 5 - 2)]
      }));
    }, 3000);

    setTimeout(() => setIsLoaded(true), 1000);
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
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 2px; position: relative; overflow: hidden; }
        .card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(90deg, transparent, ${CYBER.primary}33, transparent); }
        
        .label { font-size: 8px; color: ${CYBER.primary}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; font-weight: bold; }
        .val-main { font-size: 24px; font-weight: bold; color: #fff; line-height: 1; }
        .val-unit { font-size: 10px; color: ${CYBER.subtext}; margin-left: 4px; }

        .op-btn { background: #fff; color: #000; border: none; padding: 12px; font-size: 10px; font-weight: 700; cursor: pointer; text-transform: uppercase; transition: 0.2s; }
        .op-btn:active { background: ${CYBER.primary}; transform: translateY(1px); }
        
        .emergency { filter: saturate(0) contrast(1.5) brightness(0.8); }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: ${CYBER.primary}44; }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <h1 style={{ color: CYBER.primary, fontSize: '22px', margin: 0, letterSpacing: '4px' }}>NEURAL_PULSE</h1>
        <div style={{ fontSize: '9px', opacity: 0.4, marginTop: '4px' }}>// STATUS: OMNI_ACTIVE // NODE: TITAN_01</div>
      </div>

      <div className="grid">
        {/* BLOCK 1: HARDWARE (With Progress Bars) */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label">System_Resource_Pulse</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <TelemetryBar label="CPU" value={stats.cpu} color={CYBER.primary} />
            <TelemetryBar label="RAM" value={stats.ram} color={CYBER.secondary} />
            <TelemetryBar label="SSD" value={stats.ssd} color={CYBER.warning} />
          </div>
        </div>

        {/* BLOCK 2: KERNEL FLOW (With Graph) */}
        <div className="card">
          <div className="label">Kernel_Flow</div>
          <div className="val-main">{stats.latency}<span className="val-unit">ms</span></div>
          <SparkGraph data={history.kernel} color={CYBER.success} />
        </div>

        {/* BLOCK 3: NETWORK DENSITY (With Graph) */}
        <div className="card">
          <div className="label">Network_Density</div>
          <div className="val-main">{stats.online}<span className="val-unit">ACTIVE</span></div>
          <SparkGraph data={history.network} color={CYBER.primary} />
        </div>

        {/* BLOCK 4: WALLET INDEX (With Graph) */}
        <div className="card">
          <div className="label">Wallet_Index</div>
          <div className="val-main">{history.wallets[6]}<span className="val-unit" style={{color: CYBER.ton}}>TON</span></div>
          <SparkGraph data={history.wallets} color={CYBER.ton} />
        </div>

        {/* BLOCK 5: LIQUIDITY PULSE (With Graph) */}
        <div className="card">
          <div className="label">Liquidity_Trend</div>
          <div className="val-main">{stats.liquidity.toFixed(0)}<span className="val-unit">$NP</span></div>
          <SparkGraph data={history.liq} color={CYBER.warning} />
        </div>

        {/* OPERATIONS CONTROL */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label">Core_Directives</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button className="op-btn" onClick={() => setLogs(p => [...p, `> BROADCAST_SENT: ${new Date().toLocaleTimeString()}`])}>📢 Broadcast</button>
            <button className="op-btn" style={{ background: isEmergency ? CYBER.danger : '#fff', color: isEmergency ? '#fff' : '#000' }} onClick={() => setIsEmergency(!isEmergency)}>⚠️ Kill_Switch</button>
          </div>
        </div>
      </div>

      {/* FOOTER: LIVE LOGS */}
      <footer style={{ marginTop: '20px', borderTop: `1px solid ${CYBER.border}`, paddingTop: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '10px' }}>
          <span style={{ color: CYBER.primary }}>[ LIVE_TELEMETRY_FEED ]</span>
          <span style={{ opacity: 0.3 }}>SECURE_SESSION_ACTIVE</span>
        </div>
        <div ref={logRef} style={{ height: '70px', overflowY: 'auto', fontSize: '10px', opacity: 0.4, lineHeight: '1.6' }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
          <div>{`> MONITORING_UPDATE: NODE_DELTA_${Math.floor(Math.random()*999)}`}</div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
