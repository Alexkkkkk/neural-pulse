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

// --- 🛠️ API BRIDGE (KERNEL CONTROL) ---
const callKernel = async (action, data = {}) => {
  try {
    const res = await fetch('/api/admin/kernel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });
    return await res.json();
  } catch (e) { return { success: false, error: e.message }; }
};

// --- 📈 НЕОНОВЫЙ ГРАФИК (V10 - ПОВЫШЕННАЯ ПЛАВНОСТЬ) ---
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
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
    </svg>
  );
});

// --- 🕹️ ПАНЕЛЬ БЫСТРОГО УПРАВЛЕНИЯ ---
const KernelActions = ({ onLog }) => {
  const runAction = async (act, label) => {
    onLog(`INITIATING_${label}...`, 'INFO');
    const res = await callKernel(act);
    if(res.success) onLog(`${label}_COMPLETED`, 'SUCCESS');
    else onLog(`${label}_FAILED: ${res.error}`, 'ERROR');
  };

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
      <button className="cmd-btn" onClick={() => runAction('REBOOT', 'CORE_REBOOT')}>🔄 REBOOT</button>
      <button className="cmd-btn" onClick={() => {
        const msg = prompt("MESSAGE TO ALL AGENTS:");
        if(msg) callKernel('BROADCAST', { msg }).then(() => onLog('BROADCAST_SENT', 'SUCCESS'));
      }}>📡 BROADCAST</button>
      <button className="cmd-btn" style={{ borderColor: CYBER.danger, color: CYBER.danger }} onClick={() => runAction('SHUTDOWN', 'EMERGENCY_STOP')}>🔒 KILL_SWITCH</button>
    </div>
  );
};

// --- 🗄️ ТАБЛИЦА С ФУНКЦИЯМИ МОДЕРАЦИИ ---
const AgentsTable = ({ users, onLog }) => {
  const handleManage = async (user) => {
    const newBal = prompt(`SET NP_BALANCE FOR @${user.username}:`, user.balance);
    if (newBal !== null) {
      onLog(`SYNCING_DB: @${user.username}`, 'INFO');
      const res = await callKernel('EDIT_USER', { id: user.id, balance: Number(newBal) });
      if(res.success) onLog(`DB_SYNC_SUCCESS: @${user.username}`, 'SUCCESS');
    }
  };

  return (
    <div className="table-container">
      <table className="cyber-table">
        <thead>
          <tr><th>AGENT_ID</th><th>USERNAME</th><th>NP_BALANCE</th><th>STATUS</th><th>ACTIONS</th></tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id || i}>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.subtext, fontSize: '10px' }}>{u.id}</td>
              <td style={{ color: CYBER.primary, fontWeight: 'bold' }}>@{u.username || 'UNKNOWN'}</td>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.warning }}>{Number(u.balance || 0).toLocaleString()} NP</td>
              <td>
                <span className={`status-badge ${u.active ? 'active' : ''}`}>
                  <span className="pulse-dot" style={{ background: u.active ? CYBER.success : CYBER.subtext, width: 4, height: 4 }}></span>
                  {u.active ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </td>
              <td>
                <button className="action-btn" onClick={() => handleManage(u)}>⚙️ MANAGE</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- 🚀 ГЛАВНЫЙ ДАШБОРД (APEX EDITION) ---
const Dashboard = (props) => {
  const { data: initialData } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [users, setUsers] = useState(initialData?.usersList || []);
  const [logs, setLogs] = useState([{ time: new Date().toLocaleTimeString(), msg: 'NEURAL_OS_V10_APEX_LOADED', type: 'SUCCESS' }]);
  
  const [stats, setStats] = useState({ cpu: 0, ram: 0, online: initialData?.totalUsers || 0, ton: 0, latency: 0, liquidity: initialData?.totalBalance || 0 });
  const [history, setHistory] = useState({
    cpu: Array(25).fill(0), ram: Array(25).fill(0), online: Array(25).fill(0), liq: Array(25).fill(0), stability: Array(25).fill(100)
  });

  const addLog = useCallback((msg, type = 'INFO') => {
    setLogs(prev => [...prev.slice(-49), { time: new Date().toLocaleTimeString(), msg, type }]);
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
           addLog(`AGENT_SYNC: @${update.user.username}`, 'SUCCESS');
        }
        if (update.event_type === 'LOG') addLog(update.message, update.level);
      } catch (err) { console.error("Sync Error", err); }
    };

    setTimeout(() => setIsLoaded(true), 800);
    return () => eventSource.close();
  }, [addLog]);

  if (!isLoaded) return <div className="loading">DECRYPTING_NEURAL_INTERFACE...</div>;

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        .app-root { background: #000; min-height: 100vh; padding: 20px; font-family: 'Inter', sans-serif; color: #fff; }
        .header h1 { font-size: 24px; font-weight: 900; letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; text-shadow: 0 0 15px ${CYBER.primary}44; }
        .nav-tabs { display: flex; gap: 20px; margin: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #4a5568; padding: 10px 0; font-size: 11px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; text-transform: uppercase; transition: 0.3s; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }
        .cmd-btn { background: none; border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; font-size: 9px; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; transition: 0.2s; }
        .cmd-btn:hover { background: ${CYBER.primary}11; border-color: ${CYBER.primary}; box-shadow: 0 0 10px ${CYBER.primary}33; }
        .res-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 15px; margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 12px; transition: 0.2s; }
        .card:hover { border-color: ${CYBER.primary}; transform: translateY(-2px); }
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
        .val-main { font-size: 28px; font-weight: 700; display: flex; align-items: baseline; font-family: 'Roboto Mono'; }
        .val-unit { font-size: 10px; color: #4a5568; margin-left: 6px; }
        .table-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; overflow: hidden; }
        .cyber-table { width: 100%; border-collapse: collapse; text-align: left; }
        .cyber-table th { padding: 15px; color: ${CYBER.subtext}; font-size: 10px; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 12px 15px; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .status-badge { font-size: 9px; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.03); color: ${CYBER.subtext}; font-family: 'Roboto Mono'; }
        .status-badge.active { color: ${CYBER.success}; background: rgba(57, 255, 20, 0.05); border: 1px solid rgba(57, 255, 20, 0.1); }
        .action-btn { background: none; border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; font-size: 9px; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
        .action-btn:hover { border-color: ${CYBER.primary}; background: ${CYBER.primary}11; }
        .terminal-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; height: 60vh; display: flex; flex-direction: column; overflow: hidden; }
        .terminal-header { background: rgba(0, 242, 254, 0.05); padding: 12px 15px; font-family: 'Roboto Mono'; font-size: 10px; color: ${CYBER.primary}; font-weight: bold; border-bottom: 1px solid ${CYBER.border}; }
        .terminal-body { padding: 15px; overflow-y: auto; flex: 1; font-family: 'Roboto Mono'; font-size: 11px; }
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; background: #000; }
        .pulse-dot { width: 6px; height: 6px; background: ${CYBER.success}; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 10px ${CYBER.success}; animation: blink 2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      <div className="header">
        <div>
          <h1>NEURAL_PULSE V10_APEX</h1>
          <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: CYBER.success, marginTop: '5px' }}>
            <span className="pulse-dot"></span>
            SYSTEM_OPERATIONAL // SYNC: REALTIME_DB
          </div>
        </div>
        <div style={{ fontSize: '10px', color: CYBER.subtext, textAlign: 'right', fontFamily: 'Roboto Mono' }}>
            LAST_UPTIME: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>DASHBOARD</button>
        <button className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>DATABASE_CONTROL</button>
        <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>TERMINAL</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <KernelActions onLog={addLog} />
          <div className="res-panel">
            <TelemetryCard label="Core_Node_Load" value={stats.cpu} data={history.cpu} color={CYBER.primary} />
            <TelemetryCard label="Sync_Memory" value={stats.ram} data={history.ram} color={CYBER.secondary} />
            <TelemetryCard label="Stability" value={stats.stability[24]} data={history.stability} color={CYBER.warning} />
          </div>

          <div className="grid">
            <DataCard label="Live_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
            <DataCard label="Ton_Reserves" value={stats.ton} unit="TON" data={history.online.map(v => v * 0.7)} color={CYBER.ton} isTon={true} />
            <DataCard label="Pulse_Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />
            <DataCard label="Network_Latency" value={Math.round(stats.latency)} unit="MS" data={history.cpu.map(v => v * 1.2)} color={CYBER.danger} />
          </div>
        </>
      )}

      {activeTab === 'agents' && <AgentsTable users={users} onLog={addLog} />}
      {activeTab === 'logs' && (
        <div className="terminal-container">
          <div className="terminal-header">LIVE_SYSTEM_LOGS // ROOT_ACCESS</div>
          <div className="terminal-body">
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '5px', display: 'flex', gap: '10px' }}>
                <span style={{ color: CYBER.subtext }}>[{log.time}]</span>
                <span style={{ color: log.type === 'ERROR' ? CYBER.danger : (log.type === 'SUCCESS' ? CYBER.success : CYBER.primary) }}>{log.type === 'SUCCESS' ? '>>' : '>'}</span>
                <span style={{ color: log.type === 'ERROR' ? CYBER.danger : (log.type === 'SUCCESS' ? CYBER.success : CYBER.text) }}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer style={{ marginTop: '30px', textAlign: 'center', opacity: 0.2, fontSize: '8px', fontFamily: 'Roboto Mono' }}>
        REALTIME_MONITORING_ACTIVE // NODE: TITAN_CORE // 10S_GATEWAY
      </footer>
    </div>
  );
};

export default Dashboard;
