import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 ЦВЕТОВАЯ ПАЛИТРА NEURAL_PULSE V4.0 (Точное соответствие скриншоту) ---
const CYBER = {
  bg: '#000000',
  card: '#0a0d14',
  primary: '#00f2fe',
  ton: '#0088CC',
  success: '#39ff14',
  danger: '#ff003c',
  warning: '#ffea00',
  secondary: '#7000ff',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: 'rgba(255, 255, 255, 0.05)',
};

// --- 📈 НЕОНОВЫЙ ГРАФИК ---
const SparkGraph = memo(({ data, color, height = 70 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * 50 - 10,
  }));

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '15px', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" 
            style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="4" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
    </svg>
  );
});

// --- 📊 ИНДИКАТОРЫ РЕСУРСОВ ---
const TelemetryBar = ({ label, value, color }) => (
  <div style={{ flex: 1, minWidth: '100px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
      <span style={{ color: '#4a5568', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
      <span style={{ color, fontSize: '11px', fontWeight: 'bold', textShadow: `0 0 8px ${color}66` }}>{Math.round(value)}%</span>
    </div>
    <div style={{ height: '5px', background: '#1a1d26', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ 
        width: `${Math.min(value, 100)}%`, height: '100%', background: color, 
        boxShadow: `0 0 12px ${color}`, transition: 'width 1s ease-in-out'
      }} />
    </div>
  </div>
);

// --- 🗳️ КАРТОЧКА ДАННЫХ ---
const DataCard = ({ label, value, unit, data, color, isTon }) => (
  <div className="card">
    <div className="label" style={{ color }}>{label}</div>
    <div className="val-main">
      {value}
      <span className="val-unit">
        {isTon ? <><span style={{ fontSize: '16px', marginLeft: '8px' }}>💎</span> {unit}</> : unit}
      </span>
    </div>
    <SparkGraph data={data} color={color} />
  </div>
);

const Dashboard = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const logRef = useRef(null);

  const [stats, setStats] = useState({ cpu: 0, ram: 0, storage: 22, online: 0, liquidity: 0, latency: 0, ton: 0 });
  const [history, setHistory] = useState({
    cpu: [10, 15, 8, 12], online: [20, 40, 35, 42], wallets: [10, 30, 60, 65], liq: [1000, 800, 400, 200], lat: [20, 30, 25, 85]
  });

  const [logs, setLogs] = useState(['> INITIALIZING_NEURAL_CORE...', '> ENCRYPTED_LINK_ESTABLISHED']);

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event_type === 'SYSTEM') {
        const nCpu = parseFloat(data.core_load || 0);
        setStats(p => ({
          ...p, cpu: nCpu, ram: data.sync_memory || 0, latency: data.network_latency || 0,
          online: data.active_agents || 0, ton: data.ton_reserve || 0, liquidity: data.total_liquidity || 0
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
    setTimeout(() => setIsLoaded(true), 600);
    return () => eventSource.close();
  }, []);

  if (!isLoaded) return <div className="loading">LOADING_SYSTEM_RESOURCES...</div>;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        
        .app-root { 
          background: #000; min-height: 100vh; padding: 25px; 
          font-family: 'Inter', sans-serif; color: #fff;
          background-image: linear-gradient(rgba(0, 242, 254, 0.03) 1px, transparent 1px), 
                            linear-gradient(90deg, rgba(0, 242, 254, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
        }
        .header { margin-bottom: 30px; }
        .header h1 { font-size: 28px; font-weight: 900; letter-spacing: 5px; color: ${CYBER.primary}; margin: 0; text-shadow: 0 0 15px ${CYBER.primary}44; }
        .status-tag { font-family: 'Roboto Mono'; font-size: 10px; color: ${CYBER.success}; margin-top: 8px; opacity: 0.8; letter-spacing: 1px; }

        .res-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 16px; padding: 25px; margin-bottom: 20px; }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .card { 
          background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 22px; border-radius: 16px; 
          position: relative; box-shadow: 0 15px 35px rgba(0,0,0,0.4);
        }
        .label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 15px; }
        .val-main { font-size: 38px; font-weight: 700; display: flex; align-items: baseline; letter-spacing: -1px; }
        .val-unit { font-size: 11px; color: #4a5568; margin-left: 8px; font-weight: 800; }

        .directive-panel { grid-column: span 2; background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 22px; border-radius: 16px; margin-top: 5px; }
        .btn-group { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 15px; }
        .op-btn { 
          background: #141820; color: #fff; border: 1px solid #222; padding: 15px; font-size: 10px; font-weight: 800; 
          cursor: pointer; text-transform: uppercase; border-radius: 8px; font-family: 'Roboto Mono'; transition: 0.2s;
        }
        .op-btn:hover { background: #1c222d; border-color: #444; }
        .btn-kill { color: ${CYBER.danger}; border-color: ${CYBER.danger}44; }
        
        .emergency { filter: saturate(0) brightness(0.7) sepia(1) hue-rotate(-50deg); }
        .loading { background: #000; height: 100vh; display: flex; align-items: center; justifyContent: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; }
      `}</style>

      <div className="header">
        <h1>NEURAL_PULSE V4.0</h1>
        <div className="status-tag">● SYSTEM_READY // UPLINK_TITAN_01 // SECURE_LAYER_6</div>
      </div>

      <div className="res-panel">
        <div className="label" style={{ color: CYBER.primary, marginBottom: '20px' }}>Neural_Node_Resources</div>
        <div style={{ display: 'flex', gap: '30px' }}>
          <TelemetryBar label="Core_Processing" value={stats.cpu} color={CYBER.primary} />
          <TelemetryBar label="Sync_Memory" value={stats.ram} color={CYBER.secondary} />
          <TelemetryBar label="Vault" value={stats.storage} color={CYBER.warning} />
        </div>
      </div>

      <div className="grid">
        <DataCard label="Active_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
        <DataCard label="Ton_Reserve" value={stats.ton.toFixed(1)} unit="TON" data={history.wallets} color={CYBER.ton} isTon={true} />
        <DataCard label="Network_Latency" value={stats.latency} unit="MS" data={history.lat} color={CYBER.danger} />
        <DataCard label="Pulse_Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />

        <div className="directive-panel">
          <div className="label" style={{ color: CYBER.primary }}>Directive_Control</div>
          <div className="btn-group">
            <button className="op-btn" onClick={() => {}}>Broadcast</button>
            <button className="op-btn" onClick={() => {}}>Purge</button>
            <button className="op-btn" onClick={() => {}}>Sync</button>
            <button className="op-btn btn-kill" onClick={() => setIsEmergency(!isEmergency)}>Kill_Switch</button>
          </div>
        </div>
      </div>

      <footer style={{ marginTop: '25px', opacity: 0.3 }}>
        <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {`> HEARTBEAT_STABLE: ${new Date().toLocaleTimeString()} // SESSION_ACTIVE`}
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
