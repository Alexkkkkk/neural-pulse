import React, { useState, useEffect, memo } from 'react';

// --- 🌌 ULTRA CYBER PALETTE V10.1 (MOBILE OPTIMIZED) ---
const CYBER = {
  bg: '#020408',
  card: 'rgba(10, 13, 20, 0.9)',
  primary: '#00f2fe',
  ton: '#0088CC',
  success: '#39ff14',
  danger: '#ff003c',
  warning: '#ffea00',
  secondary: '#7000ff',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: 'rgba(0, 242, 254, 0.15)',
  glow: 'rgba(0, 242, 254, 0.05)',
};

// --- 📈 NEON SPARKLINE (ADAPTIVE & ANIMATED) ---
const SparkGraph = memo(({ data, color, height = 45 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * (height * 0.6) - 5,
  }));

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;
  const gradId = `grad-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ marginTop: '8px', overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} style={{ transition: 'all 0.5s ease' }} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill={color}>
        <animate attributeName="r" values="2.5;4;2.5" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
});

// --- 💎 ANALYTIC WIDGET (COMPACT) ---
const AnalyticCard = ({ label, value, unit, data, color, trend }) => (
  <div className="card analytic-card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
      <span className="label" style={{ color, fontSize: '9px' }}>{label}</span>
      {trend && (
        <span style={{ color: trend > 0 ? CYBER.success : CYBER.danger, fontSize: '9px', fontWeight: 'bold' }}>
          {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="val-main">
      {value} <span className="val-unit">{unit}</span>
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
    cpu: Array(15).fill(0), ram: Array(15).fill(0), 
    online: Array(15).fill(0), lat: Array(15).fill(0), 
    liq: Array(15).fill(0), health: Array(15).fill(100)
  });

  const updateHistory = (arr, val) => [...arr.slice(1), Number(val)];

  const addLog = (msg, type = 'system') => {
    setLogs(prev => [{ id: Date.now(), msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));
  };

  const addAlert = (msg, type) => {
    const id = Date.now();
    if (!systemAlerts.find(a => a.msg === msg)) {
      setSystemAlerts(prev => [{ id, msg, type }, ...prev].slice(0, 3));
      addLog(msg, 'warning');
      setTimeout(() => setSystemAlerts(prev => prev.filter(a => a.id !== id)), 5000);
    }
  };

  const processStreamUpdate = (newData) => {
    const cpu = Number(newData.core_load || 0);
    const ram = Number(newData.sync_memory || 0);
    const lat = Number(newData.network_latency || 0);
    const online = Number(newData.active_agents || 0);
    const liq = Number(newData.pulse_liquidity || 0);
    
    const healthScore = Math.max(0, 100 - (cpu * 0.4) - (lat / 12) - (ram > 500 ? 15 : 0)).toFixed(1);

    setStats({ cpu, ram: ram.toFixed(1), online, latency: lat, liquidity: liq, health: healthScore });
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

  if (!isLoaded) return <div style={{ background: CYBER.bg, color: CYBER.primary, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Roboto Mono', letterSpacing: '4px' }}>INITIALIZING_PULSE_V10.0...</div>;

  return (
    <div className="app-root">
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; color: #fff; font-family: 'Inter', sans-serif; max-width: 500px; margin: 0 auto; }
        .header-meta { margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-start; }
        .title { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
        .status-line { font-size: 8px; font-family: 'Roboto Mono'; margin-top: 4px; display: flex; gap: 8px; }
        
        .tab-nav { display: flex; gap: 20px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-link { background: none; border: none; color: ${CYBER.subtext}; padding: 10px 0; font-size: 10px; font-weight: 700; cursor: pointer; text-transform: uppercase; font-family: 'Roboto Mono'; }
        .tab-link.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; text-shadow: 0 0 10px ${CYBER.primary}; }

        .grid-main { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .full-width { grid-column: span 2; }
        
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 14px; position: relative; backdrop-filter: blur(10px); }
        .label { text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; font-weight: 800; font-size: 9px; }
        .val-main { font-family: 'Roboto Mono', monospace; font-weight: 700; font-size: 26px; margin-top: 4px; display: flex; align-items: baseline; }
        .val-unit { color: ${CYBER.subtext}; margin-left: 4px; font-size: 10px; }

        .health-bar { width: 100%; height: 3px; background: rgba(255,255,255,0.05); margin: 10px 0; border-radius: 2px; }
        .health-fill { height: 100%; transition: width 1s ease; box-shadow: 0 0 8px ${CYBER.primary}; }

        .alert-toast { position: fixed; top: 15px; right: 15px; z-index: 1000; }
        .alert-item { padding: 10px 15px; background: rgba(255,0,60,0.2); color: #ff003c; border-left: 3px solid #ff003c; font-size: 10px; font-family: 'Roboto Mono'; margin-bottom: 5px; backdrop-filter: blur(10px); }

        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { text-align: left; font-size: 8px; color: ${CYBER.primary}; padding: 8px; border-bottom: 1px solid ${CYBER.border}; }
        td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.02); }

        .log-line { font-family: 'Roboto Mono'; font-size: 9px; padding: 5px 0; display: flex; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .log-type-system { color: ${CYBER.primary}; }
        .log-type-warning { color: ${CYBER.warning}; }
      `}</style>

      {/* ALERTS */}
      <div className="alert-toast">
        {systemAlerts.map(a => <div key={a.id} className="alert-item">[!] {a.msg}</div>)}
      </div>

      <header className="header-meta">
        <div>
          <h1 className="title">NEURAL<span style={{ color: CYBER.primary }}>PULSE</span></h1>
          <div className="status-line">
            <span style={{ color: CYBER.success }}>● STABLE</span>
            <span style={{ opacity: 0.4 }}>NL_NODE_01</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9px', fontFamily: 'Roboto Mono', opacity: 0.5 }}>
          UPTIME: 142:12:08
        </div>
      </header>

      <nav className="tab-nav">
        <button className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Metrics</button>
        <button className={`tab-link ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>Agents</button>
        <button className={`tab-link ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Logs</button>
      </nav>

      {activeTab === 'overview' && (
        <div className="grid-main">
          {/* HEALTH INDEX */}
          <div className="card full-width" style={{ background: 'linear-gradient(135deg, rgba(0,242,254,0.05) 0%, rgba(10,13,20,1) 100%)' }}>
            <div className="label" style={{ color: CYBER.primary }}>System Efficiency</div>
            <div className="val-main" style={{ fontSize: '42px' }}>{stats.health}<span className="val-unit" style={{ fontSize: '16px' }}>%</span></div>
            <div className="health-bar">
              <div className="health-fill" style={{ width: `${stats.health}%`, backgroundColor: stats.health > 75 ? CYBER.success : CYBER.danger }}></div>
            </div>
            <SparkGraph data={history.health} color={CYBER.primary} height={50} />
          </div>

          {/* 2-COLUMN METRICS */}
          <AnalyticCard label="CPU_Load" value={stats.cpu} unit="%" data={history.cpu} color={CYBER.primary} trend={+2.1} />
          <AnalyticCard label="RAM_Sync" value={stats.ram} unit="MB" data={history.ram} color={CYBER.secondary} />
          <AnalyticCard label="Net_Latency" value={Math.round(stats.latency)} unit="MS" data={history.lat} color={CYBER.danger} />
          <AnalyticCard label="Active_Links" value={stats.online} unit="ID" data={history.online} color={CYBER.success} trend={+12} />
          <AnalyticCard label="Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />
          <AnalyticCard label="Stability" value="100" unit="%" data={[100, 100, 100, 100]} color={CYBER.ton} />
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="card full-width">
          <div className="label" style={{ marginBottom: '10px' }}>Neural_Links_Sync</div>
          <input 
            placeholder="FILTER ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${CYBER.border}`, padding: '10px', borderRadius: '8px', color: '#fff', marginBottom: '15px', outline: 'none', fontSize: '11px' }}
          />
          <table>
            <thead><tr><th>IDENTITY</th><th>CREDITS</th><th>PULSE</th></tr></thead>
            <tbody>
              {(initialData?.usersList || []).filter(u => String(u.username || u.id).includes(searchTerm)).map((u, i) => (
                <tr key={i}>
                  <td style={{ color: CYBER.primary, fontFamily: 'Roboto Mono' }}>{u.username || u.id}</td>
                  <td style={{ fontWeight: 'bold' }}>{Number(u.balance || 0).toLocaleString()}</td>
                  <td style={{ width: '50px' }}><SparkGraph data={[10, 25, 15, 30]} color={CYBER.success} height={15} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card full-width" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <div className="label" style={{ marginBottom: '10px' }}>Live_System_Stream</div>
          {logs.map(log => (
            <div className="log-line" key={log.id}>
              <span style={{ opacity: 0.3 }}>{log.time}</span>
              <span className={`log-type-${log.type}`}>[{log.type.toUpperCase()}]</span>
              <span>{log.msg}</span>
            </div>
          ))}
        </div>
      )}

      <footer style={{ marginTop: '30px', opacity: 0.3, fontSize: '8px', fontFamily: 'Roboto Mono', textAlign: 'center' }}>
        CORE_V10.0 // BUILD_2026.04 // UPDATED: {lastUpdate.toLocaleTimeString()}
      </footer>
    </div>
  );
};

export default Dashboard;
