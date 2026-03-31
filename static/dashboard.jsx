import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 NEURAL_PULSE SUPREME PALETTE (From Screenshot) ---
const CYBER = {
  bg: '#020406',
  card: '#0a0e14',
  primary: '#00f2fe',    // Neon Cyan
  ton: '#0088CC',
  success: '#39ff14',   // Neon Green
  danger: '#ff003c',    // Neon Red
  warning: '#ffea00',   // Neon Yellow
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: '#1a1f26',
};

// --- 📈 PROGRESS BAR COMPONENT (For Telemetry) ---
const TelemetryBar = ({ label, value, color, unit = "%" }) => (
  <div style={{ marginBottom: '15px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ color }}>{value}{unit}</span>
    </div>
    <div style={{ width: '100%', height: '4px', background: '#111', borderRadius: '1px', overflow: 'hidden' }}>
      <div 
        style={{ 
          width: `${value}%`, 
          height: '100%', 
          background: color, 
          boxShadow: `0 0 10px ${color}44`,
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' 
        }} 
      />
    </div>
  </div>
);

// --- 📉 AREA CHART COMPONENT (For Kernel Efficiency) ---
const AreaChart = memo(({ data, color, height = 40 }) => {
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - (val / 100) * height,
  }));
  const areaPath = `M 0,${height} ${points.map(p => `L ${p.x},${p.y}`).join(' ')} L 100,${height} Z`;
  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible' }}>
      <path d={areaPath} fill={`${color}15`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
});

const Dashboard = (props) => {
  const { data } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const logRef = useRef(null);

  // --- 🛰️ EXTENDED MONITORING STATE ---
  const [stats, setStats] = useState({
    cpu: 14,
    ram: 38,
    ssd: 22,
    latency: 45,
    agents_db: data?.totalUsers || 1240,
    agents_online: 42,
    wallets_reg: 850,
    wallets_active: 112,
    liquidity: 1000
  });

  const [logs, setLogs] = useState(['> UPLINK_ESTABLISHED', '> KERNEL_MODULE_V9.9.2_LOADED']);
  const [kernelHistory, setKernelHistory] = useState([40, 45, 30, 55, 48, 60, 42]);

  useEffect(() => {
    // Симуляция живого потока данных (SSE/Websocket)
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpu: Math.floor(Math.random() * (20 - 10) + 10),
        agents_online: Math.floor(Math.random() * (50 - 30) + 30),
        latency: Math.floor(Math.random() * (60 - 40) + 40)
      }));
      
      // Обновление графика
      setKernelHistory(prev => [...prev.slice(1), Math.floor(Math.random() * 50 + 20)]);
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
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'Roboto Mono', monospace; color: ${CYBER.text}; }
        .header { margin-bottom: 30px; position: relative; }
        .status-dot { width: 6px; height: 6px; background: ${CYBER.success}; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 8px ${CYBER.success}; }
        
        .grid { display: grid; grid-template-columns: 1fr; gap: 15px; }
        @media (min-width: 768px) { .grid { grid-template-columns: 1fr 1fr; } }

        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 20px; border-radius: 2px; position: relative; overflow: hidden; }
        .card::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(90deg, transparent, ${CYBER.primary}44, transparent); }
        
        .label-main { font-size: 10px; color: ${CYBER.primary}; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 2px; font-weight: bold; }
        .metric-group { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .val-big { font-size: 32px; font-weight: bold; color: #fff; line-height: 1; }
        .val-sub { font-size: 9px; color: ${CYBER.subtext}; text-transform: uppercase; margin-top: 8px; }

        .tabs { display: flex; gap: 25px; margin-bottom: 25px; border-bottom: 1px solid #1a1f26; }
        .tab { background: none; border: none; color: #333; padding: 12px 0; font-size: 11px; cursor: pointer; text-transform: uppercase; font-weight: bold; }
        .tab.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }

        .op-btn { background: #fff; color: #000; border: none; padding: 12px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s; }
        .op-btn:hover { background: ${CYBER.primary}; }
        
        .emergency { filter: hue-rotate(-160deg) saturate(1.2) contrast(1.1); }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ color: CYBER.primary, fontSize: '26px', margin: 0, letterSpacing: '3px' }}>NEURAL_PULSE</h1>
            <div style={{ fontSize: '9px', color: CYBER.success, marginTop: '5px' }}>
              <span className="status-dot"></span> UPLINK_ESTABLISHED // v9.9.2
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '9px', opacity: 0.4 }}>
            ROOT@TITAN_NODE_01 //<br/> SECURE_ENCRYPTED_SESSION
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ OVERVIEW ]</button>
        <button className={`tab ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>[ NETWORK_ANALYSIS ]</button>
      </div>

      <div className="grid">
        {/* BLOCK 1: HARDWARE TELEMETRY */}
        <div className="card">
          <div className="label-main">System_Hardware_Telemetry</div>
          <TelemetryBar label="Kernel_CPU_Load" value={stats.cpu} color={CYBER.primary} />
          <TelemetryBar label="Physical_Memory" value={stats.ram} color={CYBER.secondary || '#7000ff'} />
          <TelemetryBar label="SSD_Storage_Pool" value={stats.ssd} color={CYBER.warning} />
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span style={{ opacity: 0.5 }}>I/O_LATENCY:</span>
            <span style={{ color: CYBER.success }}>{stats.latency}ms</span>
          </div>
        </div>

        {/* BLOCK 2: NETWORK DENSITY */}
        <div className="card">
          <div className="label-main">Network_Density_Analysis</div>
          <div className="metric-group">
            <div>
              <div className="val-big">{stats.agents_db}</div>
              <div className="val-sub">Agents_In_DB</div>
            </div>
            <div>
              <div className="val-big" style={{ color: CYBER.success }}>{stats.agents_online}</div>
              <div className="val-sub" style={{ color: CYBER.success }}>Agents_Online</div>
            </div>
            <div>
              <div className="val-big" style={{ color: CYBER.ton }}>{stats.wallets_reg}</div>
              <div className="val-sub">Wallets_Registered</div>
            </div>
            <div>
              <div className="val-big" style={{ color: CYBER.primary }}>{stats.wallets_active}</div>
              <div className="val-sub">Wallets_Active</div>
            </div>
          </div>
        </div>

        {/* BLOCK 3: KERNEL EFFICIENCY (Chart) */}
        <div className="card">
          <div className="label-main" style={{ color: CYBER.success }}>Kernel_Efficiency_Flow</div>
          <div className="val-big" style={{ fontSize: '24px' }}>{kernelHistory[kernelHistory.length - 1]}%</div>
          <AreaChart data={kernelHistory} color={CYBER.success} />
        </div>

        {/* BLOCK 4: GLOBAL LIQUIDITY */}
        <div className="card">
          <div className="label-main">Global_Network_Liquidity</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <div className="val-big" style={{ color: CYBER.primary }}>{stats.liquidity.toLocaleString()}</div>
            <div style={{ color: CYBER.primary, fontSize: '14px', fontWeight: 'bold' }}>$NP</div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '25px' }}>
            <button className="op-btn">📢 BROADCAST</button>
            <button className="op-btn" onClick={() => setIsEmergency(!isEmergency)}>⚠️ KILL_SWITCH</button>
          </div>
        </div>
      </div>

      {/* FOOTER: LIVE FEED */}
      <footer style={{ marginTop: '30px', borderTop: '1px solid #1a1f26', paddingTop: '20px' }}>
        <div className="label-main" style={{ fontSize: '9px', marginBottom: '10px' }}>[ Live_System_Feed ]</div>
        <div ref={logRef} style={{ height: '80px', overflowY: 'auto', fontSize: '10px', opacity: 0.4, lineHeight: '1.6' }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
          <div>{`> MONITORING_METRICS_UPDATE: ${new Date().toLocaleTimeString()}`}</div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
