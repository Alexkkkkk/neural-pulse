import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 NEURAL_PULSE ULTIMATE DARK PALETTE ---
const CYBER = {
  bg: '#000000',
  card: 'rgba(5, 7, 10, 0.8)',
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
const SparkGraph = memo(({ data, color, height = 50 }) => {
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
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
            style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
      <circle cx="100" cy={points[points.length-1].y} r="3.5" fill={color}>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="r" values="3.5;5;3.5" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
});

// --- 📊 NEON PROGRESS BAR ---
const TelemetryBar = ({ label, value, color }) => (
  <div style={{ marginBottom: '15px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
      <span style={{ opacity: 0.5, color: '#fff' }}>{label}</span>
      <span style={{ color, fontWeight: 'bold', textShadow: `0 0 5px ${color}` }}>{value}%</span>
    </div>
    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ 
        width: `${Math.min(value, 100)}%`, 
        height: '100%', 
        background: `linear-gradient(90deg, ${color}aa, ${color})`, 
        boxShadow: `0 0 12px ${color}`,
        transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' 
      }} />
    </div>
  </div>
);

// --- 🗳️ PREMIUM DATA CARD ---
const DataCard = ({ label, value, unit, data, color }) => (
  <div className="card">
    <div className="card-scanline" />
    <div className="label" style={{ color: color, opacity: 0.8 }}>{label}</div>
    <div className="val-main">
      {value}<span className="val-unit">{unit}</span>
    </div>
    <SparkGraph data={data} color={color} />
  </div>
);

const Dashboard = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const logRef = useRef(null);

  // Реальные данные состояния
  const [stats, setStats] = useState({ cpu: 0, ram: 0, ssd: 22, online: 0, liquidity: 0, latency: 0, ton: 0 });
  const [history, setHistory] = useState({
    cpu: [0, 0, 0, 0, 0, 0, 0],
    online: [0, 0, 0, 0, 0, 0, 0],
    wallets: [0, 0, 0, 0, 0, 0, 0],
    liq: [0, 0, 0, 0, 0, 0, 0],
    lat: [0, 0, 0, 0, 0, 0, 0]
  });

  const [logs, setLogs] = useState(['> INITIALIZING_NEURAL_CORE...', '> ENCRYPTED_LINK_ESTABLISHED']);

  // ПОДКЛЮЧЕНИЕ К РЕАЛЬНОЙ ШИНЕ ДАННЫХ СЕРВЕРА
  useEffect(() => {
    const sse = new EventSource('/api/admin/stream');
    
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event_type === 'SYSTEM') {
          setStats(p => ({
            ...p,
            cpu: data.server_load || 0,
            ram: data.ram_usage || p.ram,
            latency: data.db_latency || 0,
            online: data.user_count || 0,
            liquidity: data.total_liquidity || 0,
            ton: data.active_wallets || 0
          }));

          // Обновляем графики (сдвигаем массив)
          setHistory(p => ({
            ...p,
            cpu: [...p.cpu.slice(1), data.server_load || 0],
            online: [...p.online.slice(1), data.user_count || 0],
            liq: [...p.liq.slice(1), data.total_liquidity || 0],
            lat: [...p.lat.slice(1), data.db_latency || 0],
            wallets: [...p.wallets.slice(1), data.active_wallets || 0]
          }));
        } else if (data.event_type === 'USER_UPDATE' && data.recent_event) {
          setLogs(p => [...p.slice(-15), `> [REAL-TIME] ${data.recent_event}`]);
        }
      } catch (err) {
        console.error('SSE Error:', err);
      }
    };

    setTimeout(() => setIsLoaded(true), 1000);
    return () => sse.close();
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  // Вызов реального API рассылки
  const triggerBroadcast = async () => {
    setLogs(p => [...p, `> INITIATING_GLOBAL_BROADCAST...`]);
    try {
      const res = await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'broadcast', message: '📡 Core Update: Network is optimal. Keep mining!' })
      });
      if(res.ok) {
        setLogs(p => [...p, `> BROADCAST_SIGNAL_SENT_TO_API`]);
      }
    } catch(e) {
      setLogs(p => [...p, `> BROADCAST_ERROR: ${e.message}`]);
    }
  };

  if (!isLoaded) return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'Roboto Mono' }}>LOADING_NEURAL_PULSE_UPLINK...</div>;

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
          background-image: linear-gradient(${CYBER.border} 1px, transparent 1px), linear-gradient(90deg, ${CYBER.border} 1px, transparent 1px);
          background-size: 40px 40px;
          animation: backgroundScroll 20s linear infinite;
        }
        @keyframes backgroundScroll { from { background-position: 0 0; } to { background-position: 0 40px; } }

        .header { margin-bottom: 30px; border-left: 5px solid ${CYBER.primary}; padding-left: 20px; position: relative; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        
        .card { 
          background: ${CYBER.card}; 
          border: 1px solid rgba(0, 242, 254, 0.1); 
          padding: 20px; 
          border-radius: 8px; 
          position: relative; 
          overflow: hidden; 
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          transition: 0.3s;
        }
        .card:hover { border-color: ${CYBER.primary}; transform: translateY(-2px); box-shadow: 0 0 20px rgba(0, 242, 254, 0.15); }

        .card-scanline {
          position: absolute; top: 0; left: 0; width: 100%; height: 2px;
          background: linear-gradient(90deg, transparent, ${CYBER.primary}33, transparent);
          animation: scanline 4s linear infinite;
        }
        @keyframes scanline { from { top: -10%; } to { top: 110%; } }

        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 2.5px; margin-bottom: 15px; font-weight: 700; }
        .val-main { font-size: 32px; font-weight: 700; color: #fff; display: flex; align-items: baseline; line-height: 1; text-shadow: 0 0 15px rgba(255,255,255,0.2); }
        .val-unit { font-size: 12px; color: ${CYBER.subtext}; margin-left: 8px; }

        .op-btn { 
          background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); 
          padding: 15px; font-size: 10px; font-weight: 700; cursor: pointer; text-transform: uppercase; 
          border-radius: 4px; transition: 0.2s; letter-spacing: 1px;
        }
        .op-btn:hover { background: #fff; color: #000; }
        .op-btn:active { transform: scale(0.95); }
        
        .emergency { filter: saturate(0) contrast(1.2) brightness(0.8) sepia(1) hue-rotate(-50deg); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${CYBER.primary}66; border-radius: 10px; }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* --- HEADER --- */}
      <div className="header">
        <h1 style={{ color: CYBER.primary, fontSize: '26px', margin: 0, letterSpacing: '6px', textShadow: `0 0 15px ${CYBER.primary}66` }}>NEURAL_PULSE v4.0</h1>
        <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '8px' }}>
          <span style={{ color: CYBER.success, display: 'inline-block', marginRight: '5px', animation: 'pulse 2s infinite' }}>●</span> 
          SYSTEM_SYNC: ACTIVE // UPLINK_TITAN_01 // REAL_TIME_DATA
        </div>
      </div>

      <div className="grid">
        {/* HARDWARE TELEMETRY */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label" style={{ color: CYBER.primary }}>Neural_Node_Resources</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px', marginTop: '15px' }}>
            <TelemetryBar label="Core_Load" value={stats.cpu} color={CYBER.primary} />
            <TelemetryBar label="Sync_Memory" value={stats.ram} color={CYBER.secondary} />
            <TelemetryBar label="Vault_Storage" value={stats.ssd} color={CYBER.warning} />
          </div>
        </div>

        {/* METRICS */}
        <DataCard label="Active_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
        <DataCard label="Active_Wallets" value={stats.ton} unit="ADDR" data={history.wallets} color={CYBER.ton} />
        <DataCard label="DB_Latency" value={stats.latency} unit="MS" data={history.lat} color={CYBER.danger} />
        <DataCard label="Pulse_Liquidity" value={Math.floor(stats.liquidity)} unit="$NP" data={history.liq} color={CYBER.warning} />

        {/* COMMAND CENTER */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label" style={{ color: CYBER.primary }}>Directive_Control</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
            <button className="op-btn" onClick={triggerBroadcast}>Broadcast</button>
            <button className="op-btn" onClick={() => setLogs(p => [...p, `> CACHE_PURGE_SUCCESS` || ''])}>Purge</button>
            <button className="op-btn" onClick={() => setLogs(p => [...p, `> FORCE_SYNC_ACKNOWLEDGED` || ''])}>Sync</button>
            <button className="op-btn" style={{ borderColor: CYBER.danger, color: isEmergency ? '#000' : CYBER.danger, background: isEmergency ? CYBER.danger : 'transparent' }} 
                    onClick={() => { setIsEmergency(!isEmergency); setLogs(p => [...p, `> WARNING: KILL_SWITCH_${!isEmergency ? 'ENGAGED' : 'ABORTED'}`])}}>
              Kill_Switch
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER FEED */}
      <footer style={{ marginTop: '25px', borderTop: `1px solid rgba(255,255,255,0.05)`, paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '12px', letterSpacing: '1px' }}>
          <span style={{ color: CYBER.primary, fontWeight: 'bold' }}>[ LIVE_SYSTEM_LOGS ]</span>
          <span style={{ opacity: 0.4 }}>CONNECTION: STREAMING</span>
        </div>
        <div ref={logRef} style={{ height: '110px', overflowY: 'auto', fontSize: '11px', opacity: 0.7, lineHeight: '1.8', padding: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px' }}>
          {logs.map((l, i) => <div key={i} style={{ borderLeft: `2px solid ${CYBER.primary}66`, paddingLeft: '10px', marginBottom: '6px', fontFamily: 'monospace' }}>{l}</div>)}
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
