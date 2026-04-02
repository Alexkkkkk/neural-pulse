import React, { useState, useEffect, memo, useMemo, useRef } from 'react';

// --- 🌌 ULTRA CYBER PALETTE V10.0 (PIXEL PERFECT) ---
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

// --- 📈 ADVANCED NEON GRAPH (V10) ---
const SparkGraph = memo(({ data, color, height = 50 }) => {
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
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} opacity="0.4" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" 
            filter="drop-shadow(0 0 5px ${color})" style={{ transition: 'all 0.5s ease' }} />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color}>
        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
});

// --- 💎 ANALYTIC WIDGET ---
const AnalyticCard = ({ label, value, unit, data, color, trend }) => (
  <div className="card analytic-card">
    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span className="label" style={{ color }}>{label}</span>
      {trend && <span className="trend" style={{ color: trend > 0 ? CYBER.success : CYBER.danger, fontSize: '10px' }}>
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
  const [logs, setLogs] = useState([]);
  
  const [stats, setStats] = useState({ cpu: 0, ram: 0, online: 0, latency: 0, liquidity: 0, health: 100 });
  const [history, setHistory] = useState({
    cpu: Array(20).fill(0), ram: Array(20).fill(0), 
    online: Array(20).fill(0), lat: Array(20).fill(0), 
    liq: Array(20).fill(0), health: Array(20).fill(100)
  });

  const updateHistory = (arr, val) => [...arr.slice(1), Number(val)];

  const addLog = (msg, type = 'system') => {
    setLogs(prev => [{ id: Date.now(), msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));
  };

  const processStreamUpdate = (newData) => {
    const cpu = Number(newData.core_load || 0);
    const ram = Number(newData.sync_memory || 0);
    const lat = Number(newData.network_latency || 0);
    const online = Number(newData.active_agents || 0);
    const liq = Number(newData.pulse_liquidity || 0);
    
    // РАСЧЕТ ИНДЕКСА ЗДОРОВЬЯ
    const healthScore = Math.max(0, 100 - (cpu * 0.4) - (lat / 12) - (ram > 500 ? 15 : 0));

    setStats({ cpu, ram: ram.toFixed(1), online, latency: lat, liquidity: liq, health: healthScore.toFixed(1) });
    setHistory(p => ({
      cpu: updateHistory(p.cpu, cpu),
      ram: updateHistory(p.ram, ram),
      online: updateHistory(p.online, online),
      lat: updateHistory(p.lat, lat),
      liq: updateHistory(p.liq, liq),
      health: updateHistory(p.health, healthScore)
    }));

    if (cpu > 85) addAlert("CRITICAL_CORE_OVERLOAD", "danger");
    setLastUpdate(new Date());
  };

  const addAlert = (msg, type) => {
    const id = Date.now();
    if (!systemAlerts.find(a => a.msg === msg)) {
      setSystemAlerts(prev => [{ id, msg, type }, ...prev].slice(0, 3));
      addLog(msg, 'warning');
      setTimeout(() => setSystemAlerts(prev => prev.filter(a => a.id !== id)), 5000);
    }
  };

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try { processStreamUpdate(JSON.parse(e.data)); } catch (err) { console.error(err); }
    };
    setTimeout(() => {
      setIsLoaded(true);
      addLog("NEURAL_PULSE_CORE_STABLE", "system");
    }, 1200);
    return () => eventSource.close();
  }, []);

  if (!isLoaded) return <div className="loading-screen" style={{ background: CYBER.bg, color: CYBER.primary, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Roboto Mono', letterSpacing: '4px' }}>INITIALIZING_PULSE_V10.0...</div>;

  return (
    <div className="app-root">
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 25px; color: #fff; font-family: 'Inter', sans-serif; max-width: 1200px; margin: 0 auto; }
        .header-meta { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
        
        .grid-main { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 16px; padding: 24px; position: relative; backdrop-filter: blur(15px); transition: 0.4s ease; }
        .card:hover { border-color: ${CYBER.primary}; box-shadow: 0 0 30px ${CYBER.glow}; transform: translateY(-3px); }
        
        .label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6; }
        .val-main { font-size: 36px; font-weight: 800; font-family: 'Roboto Mono'; margin: 10px 0; display: flex; align-items: baseline; }
        .val-unit { font-size: 12px; margin-left: 8px; color: ${CYBER.subtext}; }
        
        .alert-toast { position: fixed; top: 20px; right: 20px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; }
        .alert-item { padding: 15px 25px; border-radius: 8px; font-family: 'Roboto Mono'; font-size: 11px; font-weight: bold; animation: slideIn 0.3s ease; border-left: 4px solid; backdrop-filter: blur(20px); }
        .alert-danger { background: rgba(255, 0, 60, 0.2); color: #ff003c; border-color: #ff003c; }
        .alert-warning { background: rgba(255, 234, 0, 0.2); color: #ffea00; border-color: #ffea00; }
        
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        .tab-nav { display: flex; gap: 30px; margin-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-link { background: none; border: none; color: ${CYBER.subtext}; padding: 15px 5px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; font-size: 12px; transition: 0.3s; position: relative; }
        .tab-link.active { color: ${CYBER.primary}; }
        .tab-link.active::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: ${CYBER.primary}; box-shadow: 0 0 10px ${CYBER.primary}; }

        .log-line { font-family: 'Roboto Mono'; font-size: 11px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.02); display: flex; gap: 15px; }
        .log-time { opacity: 0.3; }
        .log-type-system { color: ${CYBER.primary}; }
        .log-type-warning { color: ${CYBER.warning}; }

        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; color: ${CYBER.primary}; padding: 15px; border-bottom: 1px solid ${CYBER.border}; }
        td { padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.02); }
      `}</style>

      {/* ТОСТЫ УВЕДОМЛЕНИЙ */}
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
            NEURAL<span style={{ color: CYBER.primary }}>PULSE</span> <span style={{ opacity: 0.3, fontSize: '14px' }}>OPERATOR V10.0</span>
          </h1>
          <div style={{ marginTop: '10px', display: 'flex', gap: '15px', fontSize: '10px', fontFamily: 'Roboto Mono' }}>
            <span style={{ color: CYBER.success }}>● CORE_ENGINE_STABLE</span>
            <span style={{ opacity: 0.4 }}>LOCATION: NETHERLANDS_NODE_01</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div id="ton-btn"></div>
          <div style={{ marginTop: '10px', fontFamily: 'Roboto Mono', fontSize: '10px', opacity: 0.5 }}>UPTIME: 142:12:08</div>
        </div>
      </header>

      <nav className="tab-nav">
        <button className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>REALTIME_METRICS</button>
        <button className={`tab-link ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>AGENT_INTELLIGENCE</button>
        <button className={`tab-link ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>SYSTEM_LOGS</button>
      </nav>

      {activeTab === 'overview' && (
        <div className="grid-main">
          {/* ГЛАВНЫЙ ИНДЕКС ЗДОРОВЬЯ */}
          <div className="card" style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, rgba(0,242,254,0.05) 0%, rgba(10,13,20,1) 100%)' }}>
            <div className="label" style={{ color: CYBER.primary }}>System_Health_Efficiency</div>
            <div className="val-main" style={{ fontSize: '64px' }}>
              {stats.health}<span className="val-unit" style={{ fontSize: '24px' }}>%</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${stats.health}%`, height: '100%', 
                backgroundColor: stats.health > 70 ? CYBER.success : CYBER.danger,
                boxShadow: `0 0 15px ${CYBER.primary}`, transition: 'width 1s ease'
              }} />
            </div>
            <SparkGraph data={history.health} color={CYBER.primary} height={60} />
          </div>

          <AnalyticCard label="Compute_Load" value={stats.cpu} unit="%" data={history.cpu} color={CYBER.primary} trend={+2.1} />
          <AnalyticCard label="Memory_Sync" value={stats.ram} unit="MB" data={history.ram} color={CYBER.secondary} trend={-0.4} />
          <AnalyticCard label="Active_Neural_Links" value={stats.online} unit="AGENTS" data={history.online} color={CYBER.success} trend={+12} />
          <AnalyticCard label="Network_Jitter" value={Math.round(stats.latency)} unit="MS" data={history.lat} color={CYBER.danger} />
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div className="label">Agent_Identity_Sync</div>
            <div style={{ fontSize: '10px', opacity: 0.4 }}>TOTAL: {initialData?.usersList?.length || 0}</div>
          </div>
          <input 
            className="search-input" 
            placeholder="FILTER BY ID OR ALIAS..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${CYBER.border}`, padding: '15px', borderRadius: '10px', color: '#fff', marginBottom: '20px', outline: 'none', fontFamily: 'Roboto Mono' }}
          />
          <table>
            <thead>
              <tr>
                <th>IDENTITY</th>
                <th>CREDITS</th>
                <th>STATUS</th>
                <th>ACTIVITY_PULSE</th>
              </tr>
            </thead>
            <tbody>
              {(initialData?.usersList || []).filter(u => String(u.username || u.id).includes(searchTerm)).map((u, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'Roboto Mono', color: CYBER.primary }}>{u.username || u.id}</td>
                  <td style={{ fontWeight: 'bold' }}>{Number(u.balance || 0).toLocaleString()} <span style={{ opacity: 0.3, fontSize: '9px' }}>$NP</span></td>
                  <td><span style={{ color: CYBER.success, fontSize: '10px' }}>● ACTIVE</span></td>
                  <td style={{ width: '120px' }}><SparkGraph data={[10, 25, 15, 35, 20]} color={CYBER.success} height={20} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card">
          <div className="label" style={{ marginBottom: '15px' }}>Raw_System_Stream</div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {logs.map(log => (
              <div className="log-line" key={log.id}>
                <span className="log-time">[{log.time}]</span>
                <span className={`log-type-${log.type}`}>[{log.type.toUpperCase()}]</span>
                <span>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer style={{ marginTop: '40px', padding: '20px', borderTop: `1px solid ${CYBER.border}`, display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'Roboto Mono', opacity: 0.4 }}>
        <div>CORE_V10.0 // STABLE_BUILD</div>
        <div>REALTIME_PULSE: {lastUpdate.toLocaleTimeString()}</div>
        <div>NEURAL_PULSE_NETWORK © 2026</div>
      </footer>
    </div>
  );
};

export default Dashboard;
