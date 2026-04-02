import React, { useState, useEffect, memo, useRef } from 'react';

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

// --- 📊 КАРТОЧКИ ТЕЛЕМЕТРИИ ---
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

// --- 🖥️ СИСТЕМНЫЙ ТЕРМИНАЛ ЛОГОВ ---
const Terminal = ({ logs }) => {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span className="pulse-dot" style={{ width: 6, height: 6, marginRight: 8, background: CYBER.danger }}></span>
        LIVE_SYSTEM_LOGS // ROOT_ACCESS
      </div>
      <div className="terminal-body">
        {logs.map((log, i) => (
          <div key={i} className="log-line">
            <span className="log-time">[{log.time}]</span>
            <span className="log-type" style={{ color: log.type === 'ERROR' ? CYBER.danger : (log.type === 'SUCCESS' ? CYBER.success : CYBER.primary) }}>
              {log.type === 'SUCCESS' ? '>>' : '>'} 
            </span>
            <span className="log-msg" style={{ color: log.type === 'SUCCESS' ? CYBER.success : (log.type === 'ERROR' ? CYBER.danger : CYBER.text) }}>
              {log.msg}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

// --- 🗄️ БАЗА ДАННЫХ АГЕНТОВ (ТАБЛИЦА) ---
const AgentsTable = ({ users }) => (
  <div className="table-container">
    <table className="cyber-table">
      <thead>
        <tr>
          <th>AGENT_ID</th>
          <th>USERNAME</th>
          <th>NP_BALANCE</th>
          <th>NETWORK_STATUS</th>
        </tr>
      </thead>
      <tbody>
        {(!users || users.length === 0) ? (
          <tr><td colSpan="4" style={{ textAlign: 'center', opacity: 0.5, padding: '30px' }}>NO_AGENTS_FOUND_IN_DATABASE</td></tr>
        ) : (
          users.map((u, i) => (
            <tr key={u.id || i}>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.subtext }}>{u.id}</td>
              <td style={{ color: CYBER.primary, fontWeight: 'bold' }}>@{u.username || 'UNKNOWN'}</td>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.warning }}>{Number(u.balance || 0).toLocaleString()} NP</td>
              <td>
                <span className="status-badge">
                  <span className="pulse-dot" style={{ width: 4, height: 4, marginRight: 4, background: u.active ? CYBER.success : CYBER.subtext }}></span>
                  {u.active ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

// --- 🚀 ГЛАВНЫЙ ДАШБОРД С АВТОРИЗАЦИЕЙ ---
const Dashboard = (props) => {
  const { data: initialData } = props;
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authKey, setAuthKey] = useState('');
  const [authError, setAuthError] = useState(false);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [users, setUsers] = useState(initialData?.usersList || []);
  const [logs, setLogs] = useState([{ time: new Date().toLocaleTimeString(), msg: 'NEURAL_OS BOOT SEQUENCE INITIATED...', type: 'INFO' }]);
  const [stats, setStats] = useState({ cpu: 0, ram: 0, online: initialData?.totalUsers || 0, ton: 0, latency: 0, liquidity: initialData?.totalBalance || 0 });
  const [history, setHistory] = useState({
    cpu: Array(15).fill(0), ram: Array(15).fill(0), stability: Array(15).fill(100),
    online: Array(15).fill(0), ton: Array(15).fill(0), lat: Array(15).fill(0), liq: Array(15).fill(0)
  });

  // Проверка сессии при загрузке
  useEffect(() => {
    const saved = sessionStorage.getItem('cyber_access_granted');
    if (saved === 'true') setIsAuthorized(true);
  }, []);

  const handleAuth = (e) => {
    e.preventDefault();
    // В реальном проекте здесь будет fetch('/api/auth', { method: 'POST', body: { authKey } })
    if (authKey === 'admin' || authKey === 'pulse2026') { // Твой ключ здесь
      setIsAuthorized(true);
      sessionStorage.setItem('cyber_access_granted', 'true');
      setAuthError(false);
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  const addLog = (msg, type = 'INFO') => {
    setLogs(prev => [...prev.slice(-99), { time: new Date().toLocaleTimeString(), msg, type }]);
  };

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

    if (newData.recent_event) addLog(newData.recent_event, newData.event_type === 'ERROR' ? 'ERROR' : 'INFO');
    setLastUpdate(new Date());
  };

  useEffect(() => {
    if (!isAuthorized) return;

    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.event_type === 'SYSTEM' || update.event_type === 'METRICS') syncState(update);
        if (update.event_type === 'USER_UPDATE' && update.user_data) {
           setUsers(prev => {
             const exists = prev.findIndex(u => u.id === update.user_data.id);
             if (exists >= 0) {
               const newArr = [...prev];
               newArr[exists] = { ...newArr[exists], balance: update.user_data.balance, active: true };
               return newArr.sort((a,b) => b.balance - a.balance);
             }
             return [{...update.user_data, active: true}, ...prev].sort((a,b) => b.balance - a.balance);
           });
           addLog(`AGENT_UPDATE: @${update.user_data.username || update.user_data.id} balance synced`, 'SUCCESS');
        }
        if (update.event_type === 'LOG') addLog(update.message, update.level || 'INFO');
      } catch (err) { console.error("Stream parse error", err); }
    };

    const interval = setInterval(() => {
       if (new Date() - lastUpdate > 9000) syncState({}); 
    }, 10000);

    setTimeout(() => {
      setIsLoaded(true);
      addLog('CONNECTION ESTABLISHED. LISTENING TO NODE DEEP-STREAM...', 'SUCCESS');
    }, 600);

    return () => { eventSource.close(); clearInterval(interval); };
  }, [lastUpdate, isAuthorized]);

  // --- ЭКРАН АВТОРИЗАЦИИ (БЕЗ ИЗМЕНЕНИЯ ДИЗАЙНА) ---
  if (!isAuthorized) {
    return (
      <div className="app-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`
          .app-root { background: #000; min-height: 100vh; font-family: 'Inter', sans-serif; color: #fff; }
          .auth-box { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 40px; border-radius: 12px; width: 100%; max-width: 320px; text-align: center; box-shadow: 0 0 30px rgba(0, 242, 254, 0.1); }
          .auth-box h1 { font-size: 18px; letter-spacing: 3px; color: ${CYBER.primary}; margin-bottom: 30px; font-weight: 900; }
          .cyber-input { background: rgba(255,255,255,0.03); border: 1px solid ${CYBER.border}; color: #fff; padding: 12px; border-radius: 6px; width: 100%; box-sizing: border-box; font-family: 'Roboto Mono'; margin-bottom: 20px; outline: none; transition: border 0.3s; }
          .cyber-input:focus { border-color: ${CYBER.primary}; box-shadow: 0 0 10px rgba(0, 242, 254, 0.2); }
          .cyber-btn { background: ${CYBER.primary}; color: #000; border: none; padding: 12px; border-radius: 6px; width: 100%; font-weight: 900; cursor: pointer; font-family: 'Roboto Mono'; letter-spacing: 1px; transition: all 0.3s; }
          .cyber-btn:hover { filter: brightness(1.2); box-shadow: 0 0 20px ${CYBER.primary}; }
          .error-msg { color: ${CYBER.danger}; font-size: 10px; font-family: 'Roboto Mono'; margin-top: 10px; text-transform: uppercase; }
        `}</style>
        <div className="auth-box">
          <h1>NEURAL_GATE_V9.8</h1>
          <form onSubmit={handleAuth}>
            <input 
              type="password" 
              className="cyber-input" 
              placeholder="ENTER_ACCESS_KEY" 
              value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              autoFocus
            />
            <button type="submit" className="cyber-btn">INITIALIZE_SESSION</button>
            {authError && <div className="error-msg">ACCESS_DENIED // INVALID_KEY</div>}
          </form>
        </div>
      </div>
    );
  }

  // --- ОСНОВНОЙ ИНТЕРФЕЙС (ТВОЙ ДИЗАЙН) ---
  if (!isLoaded) return <div className="loading">CONNECTING_TO_NEURAL_PULSE_NODE...</div>;

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        .app-root { background: #000; min-height: 100vh; padding: 20px; font-family: 'Inter', sans-serif; color: #fff; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 24px; font-weight: 900; letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; text-shadow: 0 0 15px rgba(0, 242, 254, 0.4); }
        .nav-tabs { display: flex; gap: 20px; margin: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px; }
        .tab-btn { background: none; border: none; color: #4a5568; padding: 10px 0; font-size: 11px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; transition: all 0.3s ease; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; text-shadow: 0 0 8px ${CYBER.primary}; }
        .res-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 15px; margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 12px; transition: transform 0.2s; }
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
        .val-main { font-size: 28px; font-weight: 700; display: flex; align-items: baseline; font-family: 'Roboto Mono'; }
        .val-unit { font-size: 10px; color: #4a5568; margin-left: 6px; font-weight: 800; }
        .loading { background: #000; height: 100vh; display: flex; align-items: center; justify-content: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; }
        .pulse-dot { width: 6px; height: 6px; background: ${CYBER.success}; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 10px ${CYBER.success}; animation: blink 2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .terminal-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; overflow: hidden; height: 65vh; display: flex; flex-direction: column; }
        .terminal-header { background: rgba(0, 242, 254, 0.05); border-bottom: 1px solid ${CYBER.border}; padding: 12px 15px; font-family: 'Roboto Mono'; font-size: 10px; color: ${CYBER.primary}; font-weight: bold; }
        .terminal-body { padding: 15px; overflow-y: auto; flex: 1; font-family: 'Roboto Mono'; font-size: 11px; line-height: 1.6; }
        .log-line { display: flex; gap: 10px; margin-bottom: 6px; }
        .table-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; overflow-x: auto; max-height: 65vh; overflow-y: auto; }
        .cyber-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
        .cyber-table th { position: sticky; top: 0; background: #05070a; color: ${CYBER.subtext}; padding: 15px; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .status-badge { display: inline-flex; align-items: center; background: rgba(57, 255, 20, 0.05); padding: 4px 8px; border-radius: 4px; font-size: 9px; font-family: 'Roboto Mono'; border: 1px solid rgba(255, 255, 255, 0.1); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${CYBER.primary}; border-radius: 2px; }
      `}</style>

      <div className="header">
        <div>
          <h1>NEURAL_PULSE V9.8</h1>
          <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: CYBER.success, marginTop: '5px' }}>
            <span className="pulse-dot"></span>
            SYSTEM_OPERATIONAL // AUTH_LEVEL: ROOT
          </div>
        </div>
        <div style={{ fontSize: '10px', color: '#4a5568', textAlign: 'right', fontFamily: 'Roboto Mono' }}>
           LAST_PULSE: {lastUpdate.toLocaleTimeString()}
           <div 
             onClick={() => { sessionStorage.clear(); window.location.reload(); }} 
             style={{ cursor: 'pointer', color: CYBER.danger, marginTop: '4px', textDecoration: 'underline' }}>
             LOGOUT
           </div>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>OVERVIEW</button>
        <button className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>AGENT_DATABASE</button>
        <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>SYSTEM_TERMINAL</button>
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

      {activeTab === 'agents' && <AgentsTable users={users} />}
      {activeTab === 'logs' && <Terminal logs={logs} />}

      <footer style={{ marginTop: '30px', textAlign: 'center', opacity: 0.2, fontSize: '8px', fontFamily: 'Roboto Mono' }}>
        ENCRYPTED_SESSION_ACTIVE // NODE: TITAN_CORE // 10S_SYNC_GATEWAY
      </footer>
    </div>
  );
};

export default Dashboard;
