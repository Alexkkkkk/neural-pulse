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

// --- 🛠️ APEX CONTROL BRIDGE ---
const sendCommand = async (cmd, data = {}) => {
  try {
    const res = await fetch('/api/admin/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, ...data })
    });
    return await res.json();
  } catch (e) { return { success: false }; }
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
    </svg>
  );
});

// --- 🕹️ ПАНЕЛЬ УПРАВЛЕНИЯ ЯДРОМ ---
const KernelControls = ({ onLog }) => {
  const execute = async (cmd, label) => {
    onLog(`INITIATING_${label}...`, 'INFO');
    const res = await sendCommand(cmd);
    if(res.success) onLog(`${label}_OK`, 'SUCCESS');
    else onLog(`${label}_FAILED`, 'ERROR');
  };

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
      <button className="cmd-btn" onClick={() => execute('RESTART', 'NODE_REBOOT')}>🔄 RESTART</button>
      <button className="cmd-btn" onClick={() => execute('CLEAR_CACHE', 'MEM_CLEAN')}>🧹 PURGE_CACHE</button>
      <button className="cmd-btn" onClick={() => {
        const msg = prompt("SEND GLOBAL BROADCAST:");
        if(msg) sendCommand('BROADCAST', { msg }).then(() => onLog('BROADCAST_SENT', 'SUCCESS'));
      }}>📡 BROADCAST</button>
    </div>
  );
};

// --- 🗄️ ТАБЛИЦА С ПОЛНЫМ УПРАВЛЕНИЕМ ---
const AgentsTable = ({ users, onLog }) => {
  const updateBalance = async (user) => {
    const amount = prompt(`EDIT NP_BALANCE FOR @${user.username}:`, user.balance);
    if (amount !== null) {
      onLog(`POSTGRES_WRITE: @${user.username}`, 'INFO');
      const res = await sendCommand('SET_BALANCE', { id: user.id, amount: Number(amount) });
      if(res.success) onLog(`SYNC_COMPLETE: @${user.username}`, 'SUCCESS');
    }
  };

  return (
    <div className="table-container">
      <table className="cyber-table">
        <thead>
          <tr><th>AGENT_ID</th><th>USERNAME</th><th>NP_BALANCE</th><th>DB_STATE</th><th>ACTIONS</th></tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id || i}>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.subtext, fontSize: '10px' }}>{u.id}</td>
              <td style={{ color: CYBER.primary, fontWeight: 'bold' }}>@{u.username || 'UNKNOWN'}</td>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.warning }}>{Number(u.balance || 0).toLocaleString()} NP</td>
              <td><span className="status-badge active">POSTGRES_OK</span></td>
              <td><button className="action-btn" onClick={() => updateBalance(u)}>MANAGE</button></td>
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
  const [logs, setLogs] = useState([{ time: new Date().toLocaleTimeString(), msg: 'NEURAL_PULSE_OS_BOOT_OK', type: 'SUCCESS' }]);
  
  // Текущие показатели из Bothost nl4 (Memory: 97.3MB)
  const [stats, setStats] = useState({ cpu: 0.1, ram: 97.3, online: initialData?.totalUsers || 0, ton: 0, latency: 5, liquidity: initialData?.totalBalance || 0 });
  const [history, setHistory] = useState({
    cpu: Array(25).fill(0), ram: Array(25).fill(97.3), online: Array(25).fill(0), liq: Array(25).fill(0), stability: Array(25).fill(100)
  });

  const addLog = useCallback((msg, type = 'INFO') => {
    setLogs(prev => [...prev.slice(-40), { time: new Date().toLocaleTimeString(), msg, type }]);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.type === 'METRICS') {
          setStats(p => ({ ...p, ...update.data }));
          setHistory(h => ({
            cpu: [...h.cpu.slice(1), update.data.cpu],
            ram: [...h.ram.slice(1), update.data.ram],
            online: [...h.online.slice(1), update.data.online],
            liq: [...h.liq.slice(1), update.data.liq],
            stability: [...h.stability.slice(1), 100 - (update.data.latency / 5)]
          }));
        }
        if (update.type === 'LOG') addLog(update.msg, update.level);
        setLastUpdate(new Date());
      } catch (err) {}
    };
    setTimeout(() => setIsLoaded(true), 800);
    return () => eventSource.close();
  }, [addLog]);

  if (!isLoaded) return <div className="loading">CONNECTING_TO_NL4_NODE...</div>;

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        .app-root { background: #000; min-height: 100vh; padding: 20px; font-family: 'Inter', sans-serif; color: #fff; }
        .header h1 { font-size: 24px; font-weight: 900; letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; text-shadow: 0 0 15px ${CYBER.primary}44; }
        .nav-tabs { display: flex; gap: 20px; margin: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #4a5568; padding: 10px 0; font-size: 11px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; text-transform: uppercase; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }
        .cmd-btn { background: rgba(0,242,254,0.05); border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; font-size: 9px; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; }
        .cmd-btn:hover { background: ${CYBER.primary}11; border-color: ${CYBER.primary}; }
        .res-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 15px; margin-bottom: 20px; display: flex; gap: 15px; flex-wrap: wrap; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 12px; }
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; color: ${CYBER.subtext}; }
        .val-main { font-size: 28px; font-weight: 700; display: flex; align-items: baseline; font-family: 'Roboto Mono'; }
        .val-unit { font-size: 10px; color: #4a5568; margin-left: 6px; }
        .table-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; overflow: hidden; }
        .cyber-table { width: 100%; border-collapse: collapse; text-align: left; }
        .cyber-table th { padding: 15px; color: ${CYBER.subtext}; font-size: 10px; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.02); font-size: 12px; }
        .status-badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(57, 255, 20, 0.1); color: ${CYBER.success}; border: 1px solid rgba(57, 255, 20, 0.2); }
        .action-btn { background: none; border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; font-size: 8px; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
        .terminal-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; height: 60vh; display: flex; flex-direction: column; overflow: hidden; }
        .terminal-header { background: rgba(0, 242, 254, 0.05); padding: 12px 15px; font-family: 'Roboto Mono'; font-size: 10px; color: ${CYBER.primary}; border-bottom: 1px solid ${CYBER.border}; }
        .terminal-body { padding: 15px; overflow-y: auto; flex: 1; font-family: 'Roboto Mono'; font-size: 11px; }
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; background: #000; }
        .pulse-dot { width: 6px; height: 6px; background: ${CYBER.success}; border-radius: 50%; display: inline-block; margin-right: 8px; animation: blink 2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      <div className="header">
        <div>
          <h1>NEURAL_PULSE V10</h1>
          <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: CYBER.success, marginTop: '5px' }}>
            <span className="pulse-dot"></span>
            NODE_NL4: ACTIVE // PRO_PLAN
          </div>
        </div>
        <div style={{ fontSize: '10px', color: CYBER.subtext, textAlign: 'right', fontFamily: 'Roboto Mono' }}>
            LAST_SYNC: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>MONITOR</button>
        <button className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>AGENTS_DB</button>
        <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>TERMINAL</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <KernelControls onLog={addLog} />
          <div className="res-panel">
            <div style={{ flex: 1 }}>
              <div className="label">Core_Usage</div>
              <div style={{ color: CYBER.primary, fontSize: '18px', fontWeight: 'bold' }}>{stats.cpu}%</div>
              <SparkGraph data={history.cpu} color={CYBER.primary} height={30} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="label">Memory_Usage</div>
              <div style={{ color: CYBER.secondary, fontSize: '18px', fontWeight: 'bold' }}>{stats.ram} MB</div>
              <SparkGraph data={history.ram} color={CYBER.secondary} height={30} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="label">Stability</div>
              <div style={{ color: CYBER.warning, fontSize: '18px', fontWeight: 'bold' }}>{history.stability[24]}%</div>
              <SparkGraph data={history.stability} color={CYBER.warning} height={30} />
            </div>
          </div>

          <div className="grid">
            <div className="card">
              <div className="label" style={{ color: CYBER.success }}>Active_Users</div>
              <div className="val-main">{stats.online}<span className="val-unit">AGENTS</span></div>
              <SparkGraph data={history.online} color={CYBER.success} />
            </div>
            <div className="card">
              <div className="label" style={{ color: CYBER.ton }}>Ton_Balance</div>
              <div className="val-main">{stats.ton}<span className="val-unit">TON</span></div>
              <SparkGraph data={history.online.map(v => v * 0.4)} color={CYBER.ton} />
            </div>
            <div className="card">
              <div className="label" style={{ color: CYBER.warning }}>Liquidity</div>
              <div className="val-main">{stats.liquidity}<span className="val-unit">$NP</span></div>
              <SparkGraph data={history.liq} color={CYBER.warning} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'agents' && <AgentsTable users={users} onLog={addLog} />}
      
      {activeTab === 'logs' && (
        <div className="terminal-container">
          <div className="terminal-header">SYSTEM_STREAM // ROOT_ACCESS</div>
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
        APEX_MONITOR_NL4 // kanderkander_ROOT // BOT_ID: 1774594734
      </footer>
    </div>
  );
};

export default Dashboard;
