import React, { useState, useEffect, memo } from 'react';

// --- 🌌 ULTRA CYBER PALETTE V10.5 (PIXEL PERFECT) ---
const CYBER = {
  bg: '#020408',
  card: 'rgba(10, 13, 20, 0.95)',
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

// --- 📈 NEON SPARKLINE (ADAPTIVE) ---
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
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
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

// --- 💎 ANALYTIC WIDGET ---
const AnalyticCard = ({ label, value, unit, data, color, trend }) => (
  <div className="card analytic-card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="label" style={{ color, fontSize: '9px' }}>{label}</span>
      {trend && <span style={{ color: trend > 0 ? CYBER.success : CYBER.danger, fontSize: '9px', fontWeight: 'bold' }}>
        {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
      </span>}
    </div>
    <div className="val-main">
      {value}<span className="val-unit">{unit}</span>
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
    setLogs(prev => [{ id: Date.now(), msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 40));
  };

  const processStreamUpdate = (newData) => {
    const cpu = Number(newData.core_load || 0);
    const ram = Number(newData.sync_memory || 0);
    const lat = Number(newData.network_latency || 0);
    const online = Number(newData.active_agents || 0);
    const liq = Number(newData.pulse_liquidity || 0);
    
    const healthScore = Math.max(0, 100 - (cpu * 0.4) - (lat / 15) - (ram > 500 ? 15 : 0)).toFixed(1);

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
      addLog("NEURAL_PULSE_CORE_CONNECTED", "system");
    }, 1200);
    return () => eventSource.close();
  }, []);

  if (!isLoaded) return <div className="loading" style={{ background: CYBER.bg, color: CYBER.primary, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Roboto Mono', letterSpacing: '4px', fontSize: '12px' }}>INITIALIZING_PULSE_V10.5...</div>;

  return (
    <div className="app-root">
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; color: #fff; font-family: 'Inter', sans-serif; max-width: 500px; margin: 0 auto; }
        .header-meta { margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-start; }
        .grid-main { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .full-width { grid-column: span 2; }
        
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 14px; padding: 15px; position: relative; backdrop-filter: blur(15px); }
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.7; }
        .val-main { font-size: 28px; font-weight: 800; font-family: 'Roboto Mono'; margin-top: 4px; display: flex; align-items: baseline; }
        .val-unit { font-size: 10px; margin-left: 4px; color: ${CYBER.subtext}; }
        
        .tab-nav { display: flex; gap: 20px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-link { background: none; border: none; color: ${CYBER.subtext}; padding: 10px 0; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; font-size: 11px; transition: 0.3s; position: relative; }
        .tab-link.active { color: ${CYBER.primary}; }
        .tab-link.active::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: ${CYBER.primary}; box-shadow: 0 0 10px ${CYBER.primary}; }

        .health-bar { width: 100%; height: 3px; background: rgba(255,255,255,0.05); margin: 10px 0; border-radius: 2px; overflow: hidden; }
        .health-fill { height: 100%; transition: width 1s ease; }

        .alert-toast { position: fixed; top: 15px; right: 15px; z-index: 1000; display: flex; flex-direction: column; gap: 8px; }
        .alert-item { padding: 10px 18px; border-radius: 6px; font-family: 'Roboto Mono'; font-size: 10px; font-weight: bold; border-left: 4px solid; backdrop-filter: blur(20px); background: rgba(255, 0, 60, 0.15); color: #ff003c; border-color: #ff003c; }

        .log-line { font-family: 'Roboto Mono'; font-size: 9px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.02); display: flex; gap: 10px; }
        .log-time { opacity: 0.3; }
        .log-type-system { color: ${CYBER.primary}; }
        .log-type-warning { color: ${CYBER.warning}; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: left; font-size: 9px; color: ${CYBER.primary}; padding: 10px; border-bottom: 1px solid ${CYBER.border}; text-transform: uppercase; }
        td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.02); font-size: 12px; }
      `}</style>

      {/* TOASTS */}
      <div className="alert-toast">
        {systemAlerts.map(a => <div key={a.id} className="alert-item">[SYSTEM_ANOMALY]: {a.msg}</div>)}
      </div>

      <header className="header-meta">
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px' }}>
            NEURAL<span style={{ color: CYBER.primary }}>PULSE</span>
          </h1>
          <div style={{ marginTop: '5px', display: 'flex', gap: '10px', fontSize: '9px', fontFamily: 'Roboto Mono' }}>
            <span style={{ color: CYBER.success }}>● CORE_STABLE</span>
            <span style={{ opacity: 0.4 }}>NODE: NL_4</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div id="ton-btn"></div>
          <div style={{ marginTop: '8px', fontFamily: 'Roboto Mono', fontSize: '9px', opacity: 0.4 }}>UPTIME: 142:12:08</div>
        </div>
      </header>

      <nav className="tab-nav">
        <button className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Metrics</button>
        <button className={`tab-link ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>Agents</button>
        <button className={`tab-link ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Logs</button>
      </nav>

      {activeTab === 'overview' && (
        <div className="grid-main">
          {/* SYSTEM HEALTH CARD */}
          <div className="card full-width" style={{ background: 'linear-gradient(135deg, rgba(0,242,254,0.05) 0%, rgba(10,13,20,1) 100%)' }}>
            <div className="label" style={{ color: CYBER.primary }}>Health Efficiency</div>
            <div className="val-main" style={{ fontSize: '48px' }}>
              {stats.health}<span className="val-unit" style={{ fontSize: '18px' }}>%</span>
            </div>
            <div className="health-bar">
              <div className="health-fill" style={{ width: `${stats.health}%`, backgroundColor: stats.health > 70 ? CYBER.success : CYBER.danger }} />
            </div>
            <SparkGraph data={history.health} color={CYBER.primary} height={50} />
          </div>

          <AnalyticCard label="CPU_Load" value={stats.cpu} unit="%" data={history.cpu} color={CYBER.primary} />
          <AnalyticCard label="Memory" value={stats.ram} unit="MB" data={history.ram} color={CYBER.secondary} />
          <AnalyticCard label="Neural_Links" value={stats.online} unit="ID" data={history.online} color={CYBER.success} />
          <AnalyticCard label="Latency" value={Math.round(stats.latency)} unit="MS" data={history.lat} color={CYBER.danger} />
          <AnalyticCard label="Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />
          <AnalyticCard label="Stability" value={100} unit="%" data={[100, 100, 100, 100]} color={CYBER.ton} />
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="card full-width">
          <div className="label">Neural_Identity_List</div>
          <input 
            placeholder="FILTER ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${CYBER.border}`, padding: '12px', borderRadius: '8px', color: '#fff', margin: '15px 0', outline: 'none', fontSize: '11px' }}
          />
          <table>
            <thead><tr><th>IDENTITY</th><th>CREDITS</th><th>PULSE</th></tr></thead>
            <tbody>
              {(initialData?.usersList || []).filter(u => String(u.username || u.id).includes(searchTerm)).map((u, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'Roboto Mono', color: CYBER.primary }}>{u.username || u.id}</td>
                  <td style={{ fontWeight: 'bold' }}>{Number(u.balance || 0).toLocaleString()}</td>
                  <td style={{ width: '60px' }}><SparkGraph data={[10, 25, 15, 30]} color={CYBER.success} height={18} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card full-width" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <div className="label" style={{ marginBottom: '10px' }}>System_Raw_Stream</div>
          {logs.map(log => (
            <div className="log-line" key={log.id}>
              <span className="log-time">[{log.time}]</span>
              <span className={`log-type-${log.type}`}>[{log.type.toUpperCase()}]</span>
              <span>{log.msg}</span>
            </div>
          ))}
        </div>
      )}

      <footer style={{ marginTop: '30px', textAlign: 'center', opacity: 0.3, fontSize: '8px', fontFamily: 'Roboto Mono' }}>
        BUILD_V10.5_STABLE // {lastUpdate.toLocaleTimeString()} // 2026
      </footer>
    </div>
  );
};

export default Dashboard;
