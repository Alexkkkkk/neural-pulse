import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 NEURAL_PULSE ULTIMATE DARK PALETTE ---
const CYBER = {
  bg: '#000000',
  card: 'rgba(5, 7, 10, 0.85)',
  primary: '#00f2fe',
  ton: '#0088CC',
  success: '#39ff14',
  danger: '#ff003c',
  warning: '#ffea00',
  secondary: '#7000ff',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: 'rgba(0, 242, 254, 0.1)',
};

// --- 📈 ADVANCED SPARKLINE ---
const SparkGraph = memo(({ data, color, height = 60 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * 50 - 5, // Небольшой отступ снизу
  }));

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '15px', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
            style={{ filter: `drop-shadow(0 0 8px ${color}aa)` }} />
      <circle cx="100" cy={points[points.length-1].y} r="3.5" fill={color}>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="r" values="3.5;5;3.5" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
});

// --- 🗳️ PREMIUM DATA CARD ---
const DataCard = ({ label, value, unit, data, color }) => (
  <div className="card">
    <div className="card-scanline" />
    <div className="label" style={{ color: color }}>{label}</div>
    <div className="val-main">
      {value}<span className="val-unit">{unit}</span>
    </div>
    <SparkGraph data={data} color={color} />
  </div>
);

// --- 📊 MINI TELEMETRY BAR ---
const TelemetryBar = ({ label, value, color }) => (
  <div style={{ flex: 1 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '8px', letterSpacing: '1px' }}>
      <span style={{ color: '#4a5568', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}%</span>
    </div>
    <div style={{ height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ 
        width: `${value}%`, 
        height: '100%', 
        background: color, 
        boxShadow: `0 0 10px ${color}`,
        transition: 'width 1s ease-in-out'
      }} />
    </div>
  </div>
);

const Dashboard = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const logRef = useRef(null);

  const [stats, setStats] = useState({ cpu: 0, ram: 38, ssd: 22, online: 0, liquidity: 0, latency: 0, ton: 0 });
  const [history, setHistory] = useState({
    cpu: Array(15).fill(0),
    online: Array(15).fill(0),
    wallets: Array(15).fill(0),
    liq: Array(15).fill(0),
    lat: Array(15).fill(0)
  });

  const [logs, setLogs] = useState(['> INITIALIZING_NEURAL_CORE...', '> ENCRYPTED_LINK_ESTABLISHED']);

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event_type === 'SYSTEM') {
        const nCpu = typeof data.core_load === 'string' ? parseFloat(data.core_load) : data.core_load;
        
        setStats(p => ({
          ...p,
          cpu: nCpu || 0, 
          ram: data.sync_memory || p.ram,
          latency: data.network_latency || 0,
          online: data.active_agents || 0,
          ton: data.ton_reserve || 0,
          liquidity: data.pulse_liquidity || 0
        }));
        
        setHistory(p => ({
          cpu: [...p.cpu.slice(1), nCpu],
          online: [...p.online.slice(1), data.active_agents],
          wallets: [...p.wallets.slice(1), data.ton_reserve],
          liq: [...p.liq.slice(1), data.pulse_liquidity],
          lat: [...p.lat.slice(1), data.network_latency]
        }));

        if(data.recent_event && data.recent_event !== 'HEARTBEAT_STABLE') {
          setLogs(p => [...p.slice(-50), `> ${data.recent_event}`]);
        }
      }
    };

    setTimeout(() => setIsLoaded(true), 800);
    return () => eventSource.close();
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  if (!isLoaded) return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'Roboto Mono' }}>BOOTING_NEURAL_PULSE_V4...</div>;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />
      
      <style>{`
        .app-root { 
          background: ${CYBER.bg}; 
          min-height: 100vh; 
          padding: 25px; 
          font-family: 'Roboto Mono', monospace; 
          color: ${CYBER.text};
          background-image: linear-gradient(${CYBER.border} 1px, transparent 1px), linear-gradient(90deg, ${CYBER.border} 1px, transparent 1px);
          background-size: 40px 40px;
          animation: backgroundScroll 30s linear infinite;
        }
        @keyframes backgroundScroll { from { background-position: 0 0; } to { background-position: 0 40px; } }

        .header { margin-bottom: 30px; border-left: 4px solid ${CYBER.primary}; padding-left: 20px; }
        .resources-box { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 25px; margin-bottom: 20px; backdrop-filter: blur(10px); }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        
        .card { 
          background: ${CYBER.card}; 
          border: 1px solid ${CYBER.border}; 
          padding: 20px; 
          border-radius: 12px; 
          position: relative; 
          overflow: hidden; 
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card:hover { border-color: ${CYBER.primary}; transform: translateY(-3px); box-shadow: 0 0 25px rgba(0, 242, 254, 0.2); }

        .card-scanline {
          position: absolute; top: 0; left: 0; width: 100%; height: 1.5px;
          background: linear-gradient(90deg, transparent, ${CYBER.primary}44, transparent);
          animation: scanline 3s linear infinite;
        }
        @keyframes scanline { from { top: -10%; } to { top: 110%; } }

        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: 700; opacity: 0.8; }
        .val-main { font-size: 34px; font-weight: 800; color: #fff; display: flex; align-items: baseline; line-height: 1; text-shadow: 0 0 20px rgba(255,255,255,0.15); }
        .val-unit { font-size: 11px; color: ${CYBER.subtext}; margin-left: 8px; font-weight: 400; }

        .op-btn { 
          background: rgba(255,255,255,0.03); color: #fff; border: 1px solid rgba(255,255,255,0.08); 
          padding: 14px; font-size: 9px; font-weight: 700; cursor: pointer; text-transform: uppercase; 
          border-radius: 6px; transition: 0.2s; letter-spacing: 1.5px;
        }
        .op-btn:hover { background: #fff; color: #000; border-color: #fff; }
        
        .emergency { filter: saturate(0.2) contrast(1.1) brightness(0.9) sepia(0.5) hue-rotate(-50deg); }
        
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${CYBER.primary}44; border-radius: 10px; }
      `}</style>

      {/* --- HEADER --- */}
      <div className="header">
        <h1 style={{ color: CYBER.primary, fontSize: '24px', margin: 0, letterSpacing: '5px', textShadow: `0 0 20px ${CYBER.primary}44` }}>NEURAL_PULSE V4.0</h1>
        <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '8px', letterSpacing: '1px' }}>
          <span style={{ color: CYBER.success }}>●</span> SYSTEM_READY // NODE_TITAN_NL // SECURE_LAYER_V6
        </div>
      </div>

      {/* --- RESOURCE BAR --- */}
      <div className="resources-box">
        <div className="label" style={{ color: CYBER.primary, marginBottom: '20px' }}>Global_Node_Telemetry</div>
        <div style={{ display: 'flex', gap: '40px' }}>
          <TelemetryBar label="Core_Load" value={stats.cpu.toFixed(1)} color={CYBER.primary} />
          <TelemetryBar label="Sync_Memory" value={stats.ram.toFixed(0)} color={CYBER.secondary} />
          <TelemetryBar label="Vault_Storage" value={22} color={CYBER.warning} />
        </div>
      </div>

      {/* --- MAIN GRID --- */}
      <div className="grid">
        <DataCard label="Neural_Node_Processing" value={stats.cpu.toFixed(1)} unit="%" data={history.cpu} color={CYBER.primary} />
        <DataCard label="Active_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
        <DataCard label="Ton_Reserve" value={stats.ton.toFixed(1)} unit="TON" data={history.wallets} color={CYBER.ton} />
        <DataCard label="Network_Latency" value={stats.latency} unit="MS" data={history.lat} color={CYBER.danger} />
        <DataCard label="Pulse_Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />

        {/* CONTROL PANEL */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label" style={{ color: CYBER.primary }}>Directive_Control</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <button className="op-btn">Broadcast</button>
            <button className="op-btn">Purge</button>
            <button className="op-btn">Sync</button>
            <button className="op-btn" style={{ borderColor: CYBER.danger, color: isEmergency ? '#000' : CYBER.danger, background: isEmergency ? CYBER.danger : 'transparent' }} 
                    onClick={() => setIsEmergency(!isEmergency)}>
              Kill_Switch
            </button>
          </div>
        </div>
      </div>

      {/* --- SYSTEM LOGS --- */}
      <footer style={{ marginTop: '25px', borderTop: `1px solid ${CYBER.border}`, paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '12px', opacity: 0.6, letterSpacing: '1px' }}>
          <span style={{ color: CYBER.primary }}>[ SYSTEM_EVENT_STREAM ]</span>
          <span>STABLE_LINK</span>
        </div>
        <div ref={logRef} style={{ height: '100px', overflowY: 'auto', fontSize: '10px', opacity: 0.4, lineHeight: '1.8', padding: '15px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: `1px solid ${CYBER.border}` }}>
          {logs.map((l, i) => <div key={i} style={{ borderLeft: `2px solid ${CYBER.primary}22`, paddingLeft: '10px', marginBottom: '5px' }}>{l}</div>)}
          <div style={{ borderLeft: `2px solid ${CYBER.primary}22`, paddingLeft: '10px' }}>{`> HEARTBEAT_STABLE: ${new Date().toLocaleTimeString()}`}</div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
