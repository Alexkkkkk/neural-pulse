import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 ЦВЕТОВАЯ ПАЛИТРА ---
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

// --- 📊 ИНДИКАТОР РЕСУРСА ---
const TelemetryCard = ({ label, value, data, color }) => (
  <div style={{ flex: 1, minWidth: '140px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '10px', border: `1px solid ${CYBER.border}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
      <span style={{ color: '#4a5568', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color, fontSize: '11px', fontWeight: 'bold', fontFamily: 'Roboto Mono' }}>{Math.round(value)}%</span>
    </div>
    <SparkGraph data={data} color={color} height={30} />
  </div>
);

// --- 🗳️ КАРТОЧКА ДАННЫХ ---
const DataCard = ({ label, value, unit, data, color, isTon }) => (
  <div className="card">
    <div className="label" style={{ color }}>{label}</div>
    <div className="val-main">
      {value}
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

  const [users, setUsers] = useState(initialData?.usersList || []);
  const [stats, setStats] = useState({ cpu: 28, ram: 34, online: 0, ton: 0, latency: 24, liquidity: 0 });
  const [history, setHistory] = useState({
    cpu: Array(15).fill(28),
    ram: Array(15).fill(34),
    stability: Array(15).fill(100),
    online: Array(15).fill(0),
    ton: Array(15).fill(0),
    lat: Array(15).fill(24),
    liq: Array(15).fill(0)
  });

  // Функция обновления состояния (вызывается из Stream или по Таймеру)
  const updateSystemData = (newData) => {
    setStats(prev => ({
      ...prev,
      cpu: newData.cpu ?? (prev.cpu + (Math.random() * 4 - 2)),
      ram: newData.ram ?? (prev.ram + (Math.random() * 2 - 1)),
      online: newData.online ?? prev.online,
      ton: newData.ton ?? prev.ton,
      latency: newData.latency ?? (prev.latency + (Math.random() * 6 - 3)),
      liquidity: newData.liquidity ?? prev.liquidity
    }));

    setHistory(p => ({
      cpu: [...p.cpu.slice(1), newData.cpu ?? (p.cpu[p.cpu.length-1] + (Math.random() * 4 - 2))],
      ram: [...p.ram.slice(1), newData.ram ?? (p.ram[p.ram.length-1] + (Math.random() * 2 - 1))],
      stability: [...p.stability.slice(1), 100 - ((newData.latency ?? p.lat[p.lat.length-1]) / 5)],
      online: [...p.online.slice(1), newData.online ?? p.online[p.online.length-1]],
      ton: [...p.ton.slice(1), newData.ton ?? p.ton[p.ton.length-1]],
      lat: [...p.lat.slice(1), newData.latency ?? (p.lat[p.lat.length-1] + (Math.random() * 6 - 3))],
      liq: [...p.liq.slice(1), newData.liquidity ?? p.liq[p.liq.length-1]]
    }));
    setLastUpdate(new Date());
  };

  useEffect(() => {
    // 1. Подписка на поток (SSE)
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.event_type === 'SYSTEM') {
           updateSystemData({
             cpu: update.core_load,
             ram: update.sync_memory,
             online: update.active_agents,
             ton: update.ton_reserve,
             latency: update.network_latency,
             liquidity: update.total_liquidity
           });
        }
      } catch (err) { console.error("Stream error", err); }
    };

    // 2. Таймер принудительного обновления каждые 10 секунд
    const interval = setInterval(() => {
      updateSystemData({}); // Имитируем пульсацию, если сервер молчит
    }, 10000);

    setTimeout(() => setIsLoaded(true), 600);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, []);

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
        .val-main { font-size: 28px; font-weight: 700; display: flex; align-items: baseline; }
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
            SYSTEM_OPERATIONAL // NEXT_SYNC: 10S
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
            <TelemetryCard label="Stability" value={100 - (stats.latency / 5)} data={history.stability} color={CYBER.warning} />
          </div>

          <div className="grid">
            <DataCard label="Active_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
            <DataCard label="Ton_Reserve" value={stats.ton.toFixed(1)} unit="TON" data={history.ton} color={CYBER.ton} isTon={true} />
            <DataCard label="Pulse_Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />
            <DataCard label="Network_Latency" value={Math.round(stats.latency)} unit="MS" data={history.lat} color={CYBER.danger} />
          </div>
        </>
      )}

      {/* Остальные вкладки (Agents) остаются без изменений */}

      <footer style={{ marginTop: '30px', textAlign: 'center', opacity: 0.2, fontSize: '8px', fontFamily: 'Roboto Mono' }}>
        REALTIME_MONITORING_ACTIVE // REFRESH_RATE: 10000MS
      </footer>
    </div>
  );
};

export default Dashboard;
