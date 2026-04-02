import React, { useState, useEffect, memo, useRef, useCallback } from 'react';

// --- 🌌 ЦВЕТОВАЯ ПАЛИТРА (V9.8 - СТРОГО ПО ТЗ) ---
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

// --- 🛠️ APEX KERNEL BRIDGE (УПРАВЛЕНИЕ) ---
const apexControl = async (command, params = {}) => {
  try {
    const res = await fetch('/api/admin/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, ...params })
    });
    return await res.json();
  } catch (e) { return { success: false, error: e.message }; }
};

// --- 📈 ГИПЕР-ПЛАВНЫЙ ГРАФИК ---
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
  const gradId = `grad-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
            style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} />
    </svg>
  );
});

// --- ⚡ ПАНЕЛЬ МГНОВЕННОГО УПРАВЛЕНИЯ ---
const QuickActions = ({ onLog }) => {
  const trigger = async (cmd, label) => {
    onLog(`EXECUTING: ${label}...`, 'INFO');
    const res = await apexControl(cmd);
    if(res.success) onLog(`${label}_EXECUTED`, 'SUCCESS');
    else onLog(`ERROR: ${res.error || 'KERNEL_TIMEOUT'}`, 'ERROR');
  };

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
      <button className="mini-cmd" onClick={() => trigger('RESTART_NODE', 'REBOOT_BOT')}>🔄 REBOOT</button>
      <button className="mini-cmd" onClick={() => trigger('FLUSH_CACHE', 'FLUSH_MEM')}>🧹 CLEAR_CACHE</button>
      <button className="mini-cmd" onClick={() => {
        const msg = prompt("BROADCAST MESSAGE:");
        if(msg) trigger('SEND_ALL', { msg });
      }}>📡 BROADCAST</button>
      <button className="mini-cmd" style={{ color: CYBER.danger }} onClick={() => trigger('MAINTENANCE_ON', 'LOCKDOWN')}>🔒 LOCKDOWN</button>
    </div>
  );
};

// --- 🗄️ УПРАВЛЕНИЕ БАЗОЙ АГЕНТОВ ---
const AgentsTable = ({ users, onLog }) => {
  const manageUser = async (user) => {
    const val = prompt(`NEW BALANCE FOR @${user.username}:`, user.balance);
    if (val !== null) {
      onLog(`SYNCING_USER_DB: @${user.username}`, 'INFO');
      const res = await apexControl('UPDATE_USER', { id: user.id, balance: Number(val) });
      if(res.success) onLog(`USER_UPDATED: @${user.username}`, 'SUCCESS');
    }
  };

  return (
    <div className="table-container">
      <table className="cyber-table">
        <thead>
          <tr><th>AGENT_ID</th><th>USERNAME</th><th>NP_BALANCE</th><th>DATABASE_SYNC</th><th>ACTIONS</th></tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id || i}>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.subtext, fontSize: '10px' }}>{u.id}</td>
              <td style={{ color: CYBER.primary, fontWeight: 'bold' }}>@{u.username || 'UNKNOWN'}</td>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.warning }}>{Number(u.balance || 0).toLocaleString()} NP</td>
              <td>
                <span className={`status-badge ${u.active ? 'active' : ''}`}>
                  {u.active ? 'POSTGRES_SYNCED' : 'IDLE'}
                </span>
              </td>
              <td><button className="action-btn" onClick={() => manageUser(u)}>MOD</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- 🚀 ГЛАВНЫЙ ДАШБОРД (APEX V10) ---
const Dashboard = (props) => {
  const { data: initialData } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [users, setUsers] = useState(initialData?.usersList || []);
  const [logs, setLogs] = useState([{ time: new Date().toLocaleTimeString(), msg: 'APEX_KERNEL_V10_INITIALIZED', type: 'SUCCESS' }]);
  
  const [stats, setStats] = useState({ cpu: 0.1, ram: 168.9, online: initialData?.totalUsers || 0, ton: 0, latency: 12, liquidity: initialData?.totalBalance || 0 });
  const [history, setHistory] = useState({
    cpu: Array(25).fill(0), ram: Array(25).fill(168), online: Array(25).fill(0), liq: Array(25).fill(0), stability: Array(25).fill(100)
  });

  const addLog = useCallback((msg, type = 'INFO') => {
    setLogs(prev => [...prev.slice(-60), { time: new Date().toLocaleTimeString(), msg, type }]);
  }, []);

  const syncState = (newData) => {
    setStats(prev => ({ ...prev, ...newData }));
    setHistory(p => ({
      cpu: [...p.cpu.slice(1), newData.core_load ?? p.cpu[24]],
      ram: [...p.ram.slice(1), newData.sync_memory ?? p.ram[24]],
      online: [...p.online.slice(1), newData.active_agents ?? p.online[24]],
      liq: [...p.liq.slice(1), newData.pulse_liquidity ?? p.liq[24]],
      stability: [...p.stability.slice(1), 100 - ((newData.network_latency ?? 0) / 10)]
    }));
    setLastUpdate(new Date());
  };

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.event_type === 'METRICS') syncState(update);
        if (update.event_type === 'USER_UPDATE') {
           setUsers(prev => {
             const idx = prev.findIndex(u => u.id === update.user.id);
             if (idx > -1) {
               const copy = [...prev];
               copy[idx] = { ...copy[idx], ...update.user, active: true };
               return copy.sort((a,b) => b.balance - a.balance);
             }
             return [update.user, ...prev].sort((a,b) => b.balance - a.balance);
           });
           addLog(`AGENT_ACTIVITY: @${update.user.username}`, 'SUCCESS');
        }
        if (update.event_type === 'LOG') addLog(update.message, update.level);
      } catch (err) { console.error("Apex Sync Error", err); }
    };
    setTimeout(() => setIsLoaded(true), 1200);
    return () => eventSource.close();
  }, [addLog]);

  if (!isLoaded) return <div className="loading">SYNCING_WITH_NL4_NODE...</div>;

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        .app-root { background: #000; min-height: 100vh; padding: 20px; font-family: 'Inter', sans-serif; color: #fff; box-sizing: border-box; }
        .header h1 { font-size: 24px; font-weight: 900; letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; text-shadow: 0 0 15px ${CYBER.primary}44; }
        .nav-tabs { display: flex; gap: 20px; margin: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #4a5568; padding: 10px 0; font-size: 11px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; text-transform: uppercase; transition: 0.3s; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }
        .mini-cmd { background: rgba(0,242,254,0.05); border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; font-size: 9px; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; }
        .mini-cmd:hover { background: ${CYBER.primary}22; border-color: ${CYBER.primary}; }
        .res-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 15px; margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 12px; transition: 0.2s; position: relative; overflow: hidden; }
        .card:hover { border-color: ${CYBER.primary}; transform: translateY(-2px); }
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; color: ${CYBER.subtext}; }
        .val-main { font-size: 28px; font-weight: 700; display: flex; align-items: baseline; font-family: 'Roboto Mono'; }
        .val-unit { font-size: 10px; color: #4a5568; margin-left: 6px; font-weight: 800; }
        .terminal-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; height: 60vh; display: flex; flex-direction: column; overflow: hidden; }
        .terminal-header { background: rgba(0, 242, 254, 0.05); padding: 12px 15px; font-family: 'Roboto Mono'; font-size: 10px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; }
        .terminal-body { padding: 15px; overflow-y: auto; flex: 1; font-family: 'Roboto Mono'; font-size: 11px; }
        .table-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; overflow: hidden; }
        .cyber-table { width: 100%; border-collapse: collapse; text-align: left; }
        .cyber-table th { padding: 15px; color: ${CYBER.subtext}; font-size: 10px; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .status-badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: ${CYBER.subtext}; }
        .status-badge.active { background: rgba(57, 255, 20, 0.1); color: ${CYBER.success}; border: 1px solid rgba(57, 255, 20, 0.2); }
        .action-btn { background: none; border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; font-size: 8px; padding: 3px 6px; border-radius: 4px; cursor: pointer; }
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; background: #000; }
        .pulse-dot { width: 6px; height: 6px; background: ${CYBER.success}; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 10px ${CYBER.success}; animation: blink 2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      <div className="header">
        <div>
          <h1>NEURAL_PULSE V10_APEX</h1>
          <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: CYBER.success, marginTop: '5px' }}>
            <span className="pulse-dot"></span>
            NODE: NL4_STABLE // TARIF: PRO_ACTIVE
          </div>
        </div>
        <div style={{ fontSize: '10px', color: CYBER.subtext, textAlign: 'right', fontFamily: 'Roboto Mono' }}>
            {lastUpdate.toLocaleTimeString()} // SYNC_OK
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>DASHBOARD</button>
        <button className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>POSTGRES_CORE</button>
        <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>SYSTEM_LOGS</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <QuickActions onLog={addLog} />
          <div className="res-panel">
            <div style={{ flex: 1, minWidth: '140px' }}>
              <div className="label">Core_Load</div>
              <div style={{ color: CYBER.primary, fontSize: '18px', fontWeight: 'bold' }}>{stats.cpu}%</div>
              <SparkGraph data={history.cpu} color={CYBER.primary} height={30} />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <div className="label">Ram_Usage</div>
              <div style={{ color: CYBER.secondary, fontSize: '18px', fontWeight: 'bold' }}>{stats.ram} MB</div>
              <SparkGraph data={history.ram} color={CYBER.secondary} height={30} />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <div className="label">Uptime_Stability</div>
              <div style={{ color: CYBER.warning, fontSize: '18px', fontWeight: 'bold' }}>{history.stability[24]}%</div>
              <SparkGraph data={history.stability} color={CYBER.warning} height={30} />
            </div>
          </div>

          <div className="grid">
            <div className="card">
              <div className="label" style={{ color: CYBER.success }}>Active_Agents</div>
              <div className="val-main">{stats.online}<span className="val-unit">USERS</span></div>
              <SparkGraph data={history.online} color={CYBER.success} />
            </div>
            <div className="card">
              <div className="label" style={{ color: CYBER.ton }}>Ton_Reserve</div>
              <div className="val-main">{stats.ton}<span className="val-unit">💎 TON</span></div>
              <SparkGraph data={history.online.map(v => v * 0.5)} color={CYBER.ton} />
            </div>
            <div className="card">
              <div className="label" style={{ color: CYBER.warning }}>Pulse_Liquidity</div>
              <div className="val-main">{stats.liquidity}<span className="val-unit">$NP</span></div>
              <SparkGraph data={history.liq} color={CYBER.warning} />
            </div>
            <div className="card">
              <div className="label" style={{ color: CYBER.danger }}>Net_Latency</div>
              <div className="val-main">{Math.round(stats.latency)}<span className="val-unit">MS</span></div>
              <SparkGraph data={history.cpu.map(v => v * 20)} color={CYBER.danger} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'agents' && <AgentsTable users={users} onLog={addLog} />}
      
      {activeTab === 'logs' && (
        <div className="terminal-container">
          <div className="terminal-header">KERNEL_LOGS // NL4_NODE_STREAM</div>
          <div className="terminal-body">
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '4px', display: 'flex', gap: '10px' }}>
                <span style={{ color: CYBER.subtext }}>[{log.time}]</span>
                <span style={{ color: log.type === 'ERROR' ? CYBER.danger : (log.type === 'SUCCESS' ? CYBER.success : CYBER.primary) }}>{log.type === 'SUCCESS' ? '>>' : '>'}</span>
                <span style={{ color: log.type === 'ERROR' ? CYBER.danger : (log.type === 'SUCCESS' ? CYBER.success : CYBER.text) }}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer style={{ marginTop: '30px', textAlign: 'center', opacity: 0.2, fontSize: '8px', fontFamily: 'Roboto Mono' }}>
        NEURAL_PULSE_OS // AUTH_OWNER: kanderkander // BOT_ID: 1774594734
      </footer>
    </div>
  );
};

export default Dashboard;
