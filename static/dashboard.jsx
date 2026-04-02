import React, { useState, useEffect, memo, useMemo, useRef } from 'react';

// --- 🌌 ULTRA CYBER PALETTE V9.9 ---
const CYBER = {
  bg: '#020408',
  card: 'rgba(10, 13, 20, 0.8)',
  primary: '#00f2fe',
  ton: '#0088CC',
  success: '#39ff14',
  danger: '#ff003c',
  warning: '#ffea00',
  secondary: '#7000ff',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: 'rgba(0, 242, 254, 0.2)',
  glow: 'rgba(0, 242, 254, 0.1)',
};

// --- 📈 ADVANCED NEON GRAPH ---
const SparkGraph = memo(({ data, color, height = 50, animate = false }) => {
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
  const gradId = `grad-${color.replace('#', '')}-${Math.random()}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} opacity="0.3" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" 
            filter="url(#glow)" style={{ transition: 'all 0.5s ease' }} />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} filter="url(#glow)">
        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
});

// --- 💎 ANALYTIC WIDGET ---
const AnalyticCard = ({ label, value, unit, data, color, trend }) => (
  <div className="card analytic-card">
    <div className="card-header">
      <span className="label" style={{ color }}>{label}</span>
      {trend && <span className="trend" style={{ color: trend > 0 ? CYBER.success : CYBER.danger }}>
        {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
      </span>}
    </div>
    <div className="val-main">
      {typeof value === 'number' ? value.toLocaleString() : value}
      <span className="val-unit">{unit}</span>
    </div>
    <SparkGraph data={data} color={color} />
  </div>
);

const Dashboard = ({ data: initialData }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [systemAlerts, setSystemAlerts] = useState([]);
  
  const [wallet, setWallet] = useState({ connected: false, address: null, balance: 0 });
  const [stats, setStats] = useState({ cpu: 0, ram: 0, online: 0, latency: 0, liquidity: 0, health: 100 });
  
  const [history, setHistory] = useState({
    cpu: Array(20).fill(0), ram: Array(20).fill(0), 
    online: Array(20).fill(0), lat: Array(20).fill(0), 
    liq: Array(20).fill(0), health: Array(20).fill(100)
  });

  const updateHistory = (arr, val) => [...arr.slice(1), Number(val)];

  const processStreamUpdate = (newData) => {
    const cpu = Number(newData.core_load || 0);
    const ram = Number(newData.sync_memory || 0);
    const lat = Number(newData.network_latency || 0);
    const online = Number(newData.active_agents || 0);
    const liq = Number(newData.pulse_liquidity || 0);
    
    // 🔥 РАСЧЕТ ИНДЕКСА ЗДОРОВЬЯ СИСТЕМЫ
    const healthScore = Math.max(0, 100 - (cpu * 0.4) - (lat / 10) - (ram > 400 ? 10 : 0));

    setStats({ cpu, ram: ram.toFixed(1), online, latency: lat, liquidity: liq, health: healthScore.toFixed(1) });
    
    setHistory(p => ({
      cpu: updateHistory(p.cpu, cpu),
      ram: updateHistory(p.ram, ram),
      online: updateHistory(p.online, online),
      lat: updateHistory(p.lat, lat),
      liq: updateHistory(p.liq, liq),
      health: updateHistory(p.health, healthScore)
    }));

    // AI ALERT LOGIC
    if (cpu > 85) addAlert("CRITICAL_CORE_OVERLOAD", "danger");
    if (lat > 300) addAlert("NETWORK_DEGRADATION", "warning");

    setLastUpdate(new Date());
  };

  const addAlert = (msg, type) => {
    const id = Date.now();
    setSystemAlerts(prev => [{ id, msg, type }, ...prev].slice(0, 3));
    setTimeout(() => setSystemAlerts(prev => prev.filter(a => a.id !== id)), 5000);
  };

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try { processStreamUpdate(JSON.parse(e.data)); } catch (err) { console.error(err); }
    };
    setTimeout(() => setIsLoaded(true), 1000);
    return () => eventSource.close();
  }, []);

  if (!isLoaded) return <div className="loading">INITIALIZING_NEURAL_PULSE_ANALYTICS...</div>;

  return (
    <div className="app-root">
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 25px; color: #fff; font-family: 'Inter', sans-serif; }
        .header-meta { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
        .system-status { font-family: 'Roboto Mono'; font-size: 10px; display: flex; flex-direction: column; gap: 5px; }
        
        .grid-main { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 16px; padding: 24px; position: relative; backdrop-filter: blur(10px); transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .card:hover { border-color: ${CYBER.primary}; box-shadow: 0 0 30px ${CYBER.glow}; transform: translateY(-5px); }
        
        .label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6; }
        .val-main { font-size: 38px; font-weight: 800; font-family: 'Roboto Mono'; margin: 10px 0; display: flex; align-items: baseline; }
        .val-unit { font-size: 12px; margin-left: 8px; color: ${CYBER.subtext}; }
        
        .alert-toast { position: fixed; top: 20px; right: 20px; z-index: 100; display: flex; flex-direction: column; gap: 10px; }
        .alert-item { padding: 12px 20px; border-radius: 8px; font-family: 'Roboto Mono'; font-size: 11px; font-weight: bold; animation: slideIn 0.3s ease; border-left: 4px solid; }
        .alert-danger { background: rgba(255, 0, 60, 0.2); color: #ff003c; border-color: #ff003c; }
        .alert-warning { background: rgba(255, 234, 0, 0.2); color: #ffea00; border-color: #ffea00; }
        
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        
        .health-bar-container { width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 15px; overflow: hidden; }
        .health-bar-fill { height: 100%; transition: width 1s ease; }

        .tab-nav { display: flex; gap: 30px; margin-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-link { background: none; border: none; color: ${CYBER.subtext}; padding: 15px 5px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; font-size: 12px; transition: 0.3s; }
        .tab-link.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; text-shadow: 0 0 10px ${CYBER.primary}; }
      `}</style>

      <div className="alert-toast">
        {systemAlerts.map(a => (
          <div key={a.id} className={`alert-item alert-${a.type}`}>
            [SYSTEM_ANOMALY]: {a.msg}
          </div>
        ))}
      </div>

      <header className="header-meta">
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, letterSpacing: '-1px' }}>
            NEURAL<span style={{ color: CYBER.primary }}>PULSE</span> <span style={{ opacity: 0.3, fontSize: '14px' }}>ANALYTICS v9.9</span>
          </h1>
          <div className="system-status" style={{ marginTop: '10px' }}>
            <span style={{ color: CYBER.success }}>● ENGINE_STABLE // 0_LOG_ERRORS</span>
            <span style={{ opacity: 0.4 }}>LOCATION: NETHERLANDS_NODE_01</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div id="ton-btn"></div>
          <div style={{ marginTop: '10px', fontFamily: 'Roboto Mono', fontSize: '10px', opacity: 0.5 }}>
            UPTIME: 142:12:08
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <button className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>REALTIME_METRICS</button>
        <button className={`tab-link ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>AGENT_INTELLIGENCE</button>
      </nav>

      {activeTab === 'overview' && (
        <div className="grid-main">
          {/* КАРТОЧКА ЗДОРОВЬЯ — ГЛАВНАЯ МЕТРИКА */}
          <div className="card" style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, rgba(0,242,254,0.05) 0%, rgba(10,13,20,1) 100%)' }}>
            <div className="label" style={{ color: CYBER.primary }}>System_Health_Index</div>
            <div className="val-main" style={{ fontSize: '64px' }}>
              {stats.health}<span className="val-unit" style={{ fontSize: '24px' }}>%</span>
            </div>
            <div className="health-bar-container">
              <div className="health-bar-fill" style={{ 
                width: `${stats.health}%`, 
                backgroundColor: stats.health > 70 ? CYBER.success : stats.health > 40 ? CYBER.warning : CYBER.danger,
                boxShadow: `0 0 10px ${stats.health > 70 ? CYBER.success : CYBER.danger}`
              }} />
            </div>
            <SparkGraph data={history.health} color={CYBER.primary} height={60} />
          </div>

          <AnalyticCard label="Compute_Load" value={stats.cpu} unit="%" data={history.cpu} color={CYBER.primary} trend={+2.1} />
          <AnalyticCard label="Memory_Sync" value={stats.ram} unit="MB" data={history.ram} color={CYBER.secondary} trend={-0.4} />
          <AnalyticCard label="Active_Neural_Links" value={stats.online} unit="AGENTS" data={history.online} color={CYBER.success} trend={+12} />
          <AnalyticCard label="Network_Jitter" value={Math.round(stats.latency)} unit="MS" data={history.lat} color={CYBER.danger} />
          <AnalyticCard label="Protocol_Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />
          <AnalyticCard label="Node_Stability" value={99.9} unit="%" data={history.health} color={CYBER.ton} />
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div className="label">Agent_Identity_Sync</div>
            <div style={{ fontSize: '10px', opacity: 0.4, fontFamily: 'Roboto Mono' }}>TOTAL_RECORDS: {initialData?.usersList?.length || 0}</div>
          </div>
          <input 
            className="search-input" 
            placeholder="FILTER BY NEURAL_ID OR ALIAS..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${CYBER.border}`, padding: '15px', borderRadius: '10px', color: '#fff', marginBottom: '20px', outline: 'none' }}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: '10px', color: CYBER.primary, borderBottom: `1px solid ${CYBER.border}` }}>
                <th style={{ padding: '15px' }}>IDENTITY</th>
                <th>CREDITS</th>
                <th>STATUS</th>
                <th>PULSE</th>
              </tr>
            </thead>
            <tbody>
              {(initialData?.usersList || []).filter(u => String(u.username || u.id).includes(searchTerm)).map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '13px' }}>
                  <td style={{ padding: '15px', fontFamily: 'Roboto Mono', color: CYBER.primary }}>{u.username || u.id}</td>
                  <td style={{ fontWeight: 'bold' }}>{Number(u.balance || 0).toLocaleString()} <span style={{ opacity: 0.3, fontSize: '9px' }}>$NP</span></td>
                  <td><span style={{ color: CYBER.success, fontSize: '10px' }}>● ACTIVE</span></td>
                  <td style={{ width: '100px' }}><SparkGraph data={[10, 20, 15, 30, 25]} color={CYBER.success} height={20} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer style={{ marginTop: '40px', padding: '20px', borderTop: `1px solid ${CYBER.border}`, display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'Roboto Mono', opacity: 0.4 }}>
        <div>CORE_VERSION: 9.9.0_STABLE // BUILD_2026.04</div>
        <div>REALTIME_PULSE: {lastUpdate.toLocaleTimeString()}</div>
        <div>NEURAL_PULSE_NETWORK © ALL_RIGHTS_RESERVED</div>
      </footer>
    </div>
  );
};
export default Dashboard;  
