import React, { useState, useEffect, memo } from 'react';

// --- 🌌 ЦВЕТОВАЯ ПАЛИТРА (V9.8) ---
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
  border: 'rgba(0, 242, 254, 0.15)',
};

// --- 📈 НЕОНОВЫЙ ГРАФИК ---
const SparkGraph = memo(({ data, color, height = 45 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * (height * 0.7) - 5,
  }));

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;
  const gradId = `grad-${color.replace('#', '')}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
            style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={color} />
    </svg>
  );
});

const TelemetryCard = ({ label, value, data, color }) => (
  <div style={{ flex: 1, minWidth: '140px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '10px', border: `1px solid ${CYBER.border}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
      <span style={{ color: '#4a5568', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color, fontSize: '11px', fontWeight: 'bold', fontFamily: 'Roboto Mono' }}>{Number(value).toFixed(1)}%</span>
    </div>
    <SparkGraph data={data} color={color} height={30} />
  </div>
);

const DataCard = ({ label, value, unit, data, color, isTon }) => (
  <div className="card">
    <div className="label" style={{ color }}>{label}</div>
    <div className="val-main">
      {typeof value === 'number' ? value.toLocaleString() : value}
      <span className="val-unit">{isTon ? '💎 ' : ''}{unit}</span>
    </div>
    <SparkGraph data={data} color={color} />
  </div>
);

const Dashboard = (props) => {
  const { data: initialData } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [stats, setStats] = useState({ cpu: 0, ram: 0, online: 0, ton: 0, latency: 0, liquidity: 0 });
  const [history, setHistory] = useState({
    cpu: Array(15).fill(0), ram: Array(15).fill(0), stability: Array(15).fill(100),
    online: Array(15).fill(0), ton: Array(15).fill(0), lat: Array(15).fill(0), liq: Array(15).fill(0)
  });

  const syncState = (newData) => {
    setStats(prev => ({
      cpu: newData.core_load ?? prev.cpu,
      ram: newData.sync_memory ?? prev.ram,
      online: newData.active_agents ?? prev.online,
      ton: newData.ton_reserve ?? prev.ton,
      latency: newData.network_latency ?? prev.latency,
      liquidity: newData.pulse_liquidity ?? prev.liquidity
    }));

    setHistory(p => ({
      cpu: [...p.cpu.slice(1), newData.core_load ?? p.cpu[p.cpu.length-1]],
      ram: [...p.ram.slice(1), newData.sync_memory ?? p.ram[p.ram.length-1]],
      stability: [...p.stability.slice(1), 100 - ((newData.network_latency ?? p.lat[p.lat.length-1]) / 10)],
      online: [...p.online.slice(1), newData.active_agents ?? p.online[p.online.length-1]],
      ton: [...p.ton.slice(1), newData.ton_reserve ?? p.ton[p.ton.length-1]],
      lat: [...p.lat.slice(1), newData.network_latency ?? p.lat[p.lat.length-1]],
      liq: [...p.liq.slice(1), newData.pulse_liquidity ?? p.liq[p.liq.length-1]]
    }));
    setLastUpdate(new Date());
  };

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.event_type === 'SYSTEM') {
           syncState(update);
        }
      } catch (err) { console.error("Stream parse error", err); }
    };

    // Таймер синхронизации каждые 10 секунд (подстраховка)
    const interval = setInterval(() => {
       if (new Date() - lastUpdate > 9000) {
          syncState({}); // Пульсация на текущих данных
       }
    }, 10000);

    setTimeout(() => setIsLoaded(true), 600);
    return () => { eventSource.close(); clearInterval(interval); };
  }, [lastUpdate]);

  if (!isLoaded) return <div className="loading">CONNECTING_TO_NEURAL_PULSE_NODE...</div>;

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        .app-root { background: #000; min-height: 100vh; padding: 20px; font-family: 'Inter', sans-serif; color: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 24px; font-weight: 900; letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; }
        .nav-tabs { display: flex; gap: 20px; margin: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #4a5568; padding: 10px 0; font-size: 11px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }
        .res-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 15px; margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 12px; }
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
        .val-main { font-size: 28px; font-weight: 700; display: flex; align-items: baseline; font-family: 'Roboto Mono'; }
        .val-unit { font-size: 10px; color: #4a5568; margin-left: 6px; font-weight: 800; }
        .loading { background: #000; height: 100vh; display: flex; align-items: center; justify-content: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; }
        .pulse-dot { width: 6px; height: 6px; background: ${CYBER.success}; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 10px ${CYBER.success}; animation: blink 2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      <div className="header">
        <div>
          <h1>NEURAL_PULSE V9.8</h1>
          <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: CYBER.success, marginTop: '5px' }}>
            <span className="pulse-dot"></span>
            SYSTEM_OPERATIONAL // SYNC_ACTIVE
          </div>
        </div>
        <div style={{ fontSize: '10px', color: '#4a5568', textAlign: 'right' }}>
           LAST_PULSE: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>OVERVIEW</button>
        <button className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>AGENT_DATABASE</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="res-panel">
            <TelemetryCard label="Core_Node_Load" value={stats.cpu} data={history.cpu} color={CYBER.primary} />
            <TelemetryCard label="Sync_Memory" value={stats.ram} data={history.ram} color={CYBER.secondary} />
            <TelemetryCard label="Stability" value={100 - (stats.latency / 10)} data={history.stability} color={CYBER.warning} />
          </div>

          <div className="grid">
            <DataCard label="Active_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
            <DataCard label="Ton_Reserve" value={stats.ton} unit="TON" data={history.ton} color={CYBER.ton} isTon={true} />
            <DataCard label="Pulse_Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />
            <DataCard label="Network_Latency" value={Math.round(stats.latency)} unit="MS" data={history.lat} color={CYBER.danger} />
          </div>
        </>
      )}

      <footer style={{ marginTop: '30px', textAlign: 'center', opacity: 0.2, fontSize: '8px', fontFamily: 'Roboto Mono' }}>
        REALTIME_MONITORING_ACTIVE // NODE: TITAN_CORE // 10S_SYNC_GATEWAY
      </footer>
    </div>
  );
};

export default Dashboard;
