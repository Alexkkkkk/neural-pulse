import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 NEURAL_PULSE ULTIMATE DARK PALETTE ---
const CYBER = {
  bg: '#000000',
  card: 'rgba(5, 7, 10, 0.9)',
  primary: '#00f2fe',
  ton: '#0088CC',
  success: '#39ff14',
  danger: '#ff003c',
  warning: '#ffea00',
  secondary: '#7000ff',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: 'rgba(0, 242, 254, 0.15)',
};

// --- 📈 NEON SPARKLINE (Графики с эффектом свечения) ---
const SparkGraph = memo(({ data, color, height = 60 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * 45 - 5,
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
            style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      <circle cx="100" cy={points[points.length-1].y} r="3.5" fill={color}>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
});

// --- 🗳️ DATA CARD ---
const DataCard = ({ label, value, unit, data, color }) => (
  <div className="card">
    <div className="card-scanline" />
    <div className="label" style={{ color }}>{label}</div>
    <div className="val-main">
      {value}<span className="val-unit">{unit}</span>
    </div>
    <SparkGraph data={data} color={color} />
  </div>
);

// --- 📊 TELEMETRY BARS (Верхняя панель ресурсов) ---
const TelemetryBar = ({ label, value, color }) => (
  <div style={{ flex: 1 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '6px' }}>
      <span style={{ color: '#555', fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}%</span>
    </div>
    <div style={{ height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ 
        width: `${Math.min(value, 100)}%`, 
        height: '100%', 
        background: color, 
        boxShadow: `0 0 10px ${color}`,
        transition: 'width 1s ease'
      }} />
    </div>
  </div>
);

const Dashboard = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const logRef = useRef(null);

  const [stats, setStats] = useState({ cpu: 0, ram: 0, storage: 22, online: 0, liquidity: 0, latency: 0, ton: 0 });
  const [history, setHistory] = useState({
    cpu: Array(12).fill(0),
    online: Array(12).fill(0),
    wallets: Array(12).fill(0),
    liq: Array(12).fill(0),
    lat: Array(12).fill(0)
  });

  const [logs, setLogs] = useState(['> INITIALIZING_NEURAL_CORE...', '> ENCRYPTED_LINK_ESTABLISHED']);

  useEffect(() => {
    const eventSource = new EventSource('/admin/stream');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event_type === 'SYSTEM') {
        // Исправляем точность чисел (округление до 1 знака)
        const nCpu = parseFloat(data.core_load || 0);
        
        setStats(p => ({
          ...p,
          cpu: nCpu, 
          ram: data.sync_memory || 0,
          latency: data.network_latency || 0,
          online: data.active_agents || 0,
          ton: data.ton_reserve || 0,
          liquidity: data.total_liquidity || 1000
        }));
        
        setHistory(p => ({
          cpu: [...p.cpu.slice(1), nCpu],
          online: [...p.online.slice(1), data.active_agents],
          wallets: [...p.wallets.slice(1), data.ton_reserve],
          liq: [...p.liq.slice(1), data.total_liquidity],
          lat: [...p.lat.slice(1), data.network_latency]
        }));
      }
    };

    setTimeout(() => setIsLoaded(true), 1000);
    return () => eventSource.close();
  }, []);

  if (!isLoaded) return <div className="loading">LOADING_NEURAL_PULSE_V4...</div>;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />
      
      <style>{`
        .app-root { 
          background: ${CYBER.bg}; 
          min-height: 100vh; 
          padding: 20px; 
          font-family: 'Roboto Mono', monospace; 
          color: ${CYBER.text};
          background-image: linear-gradient(${CYBER.border} 1px, transparent 1px), 
                            linear-gradient(90deg, ${CYBER.border} 1px, transparent 1px);
          background-size: 45px 45px;
          animation: bgScroll 20s linear infinite;
        }
        @keyframes bgScroll { from { background-position: 0 0; } to { background-position: 0 45px; } }

        .header { margin-bottom: 25px; border-left: 4px solid ${CYBER.primary}; padding-left: 15px; }
        .header h1 { font-size: 22px; letter-spacing: 4px; margin: 0; color: ${CYBER.primary}; text-shadow: 0 0 10px ${CYBER.primary}55; }
        .status-line { font-size: 9px; opacity: 0.6; margin-top: 5px; letter-spacing: 1px; }

        .resources-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 8px; padding: 20px; margin-bottom: 15px; backdrop-filter: blur(5px); }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        
        .card { 
          background: ${CYBER.card}; 
          border: 1px solid ${CYBER.border}; 
          padding: 18px; 
          border-radius: 10px; 
          position: relative; 
          overflow: hidden; 
          box-shadow: 0 5px 20px rgba(0,0,0,0.5);
          transition: transform 0.2s;
        }
        .card:hover { transform: scale(1.02); border-color: ${CYBER.primary}55; }

        .card-scanline {
          position: absolute; top: 0; left: 0; width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, ${CYBER.primary}33, transparent);
          animation: scan 4s linear infinite;
        }
        @keyframes scan { from { top: -10%; } to { top: 110%; } }

        .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; font-weight: bold; }
        .val-main { font-size: 30px; font-weight: 700; color: #fff; display: flex; align-items: baseline; }
        .val-unit { font-size: 10px; color: ${CYBER.subtext}; margin-left: 6px; }

        .op-btn { 
          background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); 
          padding: 12px; font-size: 9px; cursor: pointer; text-transform: uppercase; border-radius: 4px;
          transition: 0.2s;
        }
        .op-btn:hover { background: #fff; color: #000; }
        
        .emergency { filter: saturate(0) brightness(0.7) sepia(1) hue-rotate(-50deg); }
        .loading { background: #000; height: 100vh; display: flex; align-items: center; justifyContent: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; }
      `}</style>

      <div className="header">
        <h1>NEURAL_PULSE V4.0</h1>
        <div className="status-line">
          <span style={{ color: CYBER.success }}>●</span> SYSTEM_READY // UPLINK_TITAN_01 // SECURE_LAYER_6
        </div>
      </div>

      <div className="resources-panel">
        <div className="label" style={{ color: CYBER.primary, marginBottom: '15px' }}>Neural_Node_Resources</div>
        <div style={{ display: 'flex', gap: '30px' }}>
          <TelemetryBar label="Core_Load" value={stats.cpu.toFixed(1)} color={CYBER.primary} />
          <TelemetryBar label="Sync_Memory" value={stats.ram.toFixed(0)} color={CYBER.secondary} />
          <TelemetryBar label="Vault_Storage" value={stats.storage} color={CYBER.warning} />
        </div>
      </div>

      <div className="grid">
        <DataCard label="Active_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
        <DataCard label="Ton_Reserve" value={stats.ton.toFixed(1)} unit="TON" data={history.wallets} color={CYBER.ton} />
        <DataCard label="Network_Latency" value={stats.latency} unit="MS" data={history.lat} color={CYBER.danger} />
        <DataCard label="Pulse_Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label" style={{ color: CYBER.primary }}>Directive_Control</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <button className="op-btn">Broadcast</button>
            <button className="op-btn">Purge</button>
            <button className="op-btn">Sync</button>
            <button className="op-btn" style={{ color: CYBER.danger, borderColor: CYBER.danger }} 
                    onClick={() => setIsEmergency(!isEmergency)}>
              {isEmergency ? 'OVERRIDE' : 'Kill_Switch'}
            </button>
          </div>
        </div>
      </div>

      <footer style={{ marginTop: '20px', opacity: 0.4, fontSize: '10px' }}>
        <div ref={logRef} style={{ height: '65px', overflow: 'hidden', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: `1px solid ${CYBER.border}` }}>
          {logs.slice(-2).map((l, i) => <div key={i} style={{ marginBottom: '4px' }}>{l}</div>)}
          <div>{`> HEARTBEAT_STABLE: ${new Date().toLocaleTimeString()}`}</div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
