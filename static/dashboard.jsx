import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

// --- 🌌 ЦВЕТОВАЯ ПАЛИТРА (CYBER V11.7) ---
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

const ADMIN_WALLET = "EQD__________________________________________"; 

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

const KernelControls = ({ onLog }) => {
  const execute = async (cmd, label) => {
    onLog(`INITIATING_${label}...`, 'INFO');
    const res = await sendCommand(cmd);
    if(res.success) onLog(`${label}_OK`, 'SUCCESS');
    else onLog(`${label}_FAILED`, 'ERROR');
  };

  return (
    <div className="controls-container">
      <button className="cmd-btn" onClick={() => execute('RESTART', 'NODE_REBOOT')}>🔄 RESTART</button>
      <button className="cmd-btn" onClick={() => execute('CLEAR_CACHE', 'MEM_CLEAN')}>🧹 PURGE</button>
      <button className="cmd-btn" onClick={() => {
        const msg = prompt("SEND GLOBAL BROADCAST:");
        if(msg) sendCommand('BROADCAST', { msg }).then(() => onLog('BROADCAST_SENT', 'SUCCESS'));
      }}>📡 BROADCAST</button>
    </div>
  );
};

const AgentsTable = ({ users, onLog }) => {
  const updateBalance = async (user) => {
    const amount = prompt(`EDIT NP_BALANCE FOR @${user.username}:`, user.balance);
    if (amount !== null && !isNaN(amount)) {
      onLog(`POSTGRES_WRITE: @${user.username}`, 'INFO');
      const res = await sendCommand('SET_BALANCE', { id: user.id, amount: Number(amount) });
      if(res.success) onLog(`SYNC_COMPLETE: @${user.username}`, 'SUCCESS');
    }
  };

  return (
    <div className="table-responsive">
      <table className="cyber-table">
        <thead>
          <tr><th>AGENT</th><th>BALANCE</th><th>WALLET</th><th>ACTION</th></tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id || i}>
              <td>
                <div style={{ color: CYBER.primary, fontWeight: 'bold' }}>@{u.username || '???'}</div>
                <div style={{ fontSize: '8px', color: CYBER.subtext }}>ID:{u.id}</div>
              </td>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.warning }}>{Number(u.balance || 0).toLocaleString()}</td>
              <td>
                {u.wallet ? (
                  <span className="status-badge" style={{ color: CYBER.ton }}>{u.wallet.slice(0, 4)}...</span>
                ) : <span style={{ opacity: 0.3 }}>-</span>}
              </td>
              <td><button className="action-btn" onClick={() => updateBalance(u)}>SET</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Dashboard = (props) => {
  const { data: initialData } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [adminBalance, setAdminBalance] = useState(0);

  const cfg = useRef(window.PULSE_CONFIG || { 
    MATH: { HEALTH_BASE: 100, CPU_WEIGHT: 0.4, LATENCY_WEIGHT: 0.15, PRECISION: 1 }, 
    SHOP: { PACKS: [] } 
  }).current;

  const [users] = useState(initialData?.usersList || []);
  const [logs, setLogs] = useState([{ time: new Date().toLocaleTimeString(), msg: 'SYSTEM_BOOT_COMPLETE', type: 'SUCCESS' }]);
  
  const [stats, setStats] = useState({ 
    cpu: 0, ram: 0, online: initialData?.totalUsers || 0, 
    ton: 0, latency: 0, liquidity: initialData?.totalBalance || 0, health: 100 
  });

  const [history, setHistory] = useState({
    cpu: Array(20).fill(0), ram: Array(20).fill(0), online: Array(20).fill(0), 
    liq: Array(20).fill(0), health: Array(20).fill(100), ton: Array(20).fill(0), 
    latency: Array(20).fill(0)
  });

  const addLog = useCallback((msg, type = 'INFO') => {
    setLogs(prev => [...prev.slice(-25), { time: new Date().toLocaleTimeString(), msg, type }]);
  }, []);

  const fetchTreasury = useCallback(async () => {
    try {
        const res = await fetch(`https://toncenter.com/api/v2/getAddressInformation?address=${ADMIN_WALLET}`);
        const json = await res.json();
        if(json.ok) {
            const bal = (parseInt(json.result.balance) / 1e9).toFixed(2);
            setAdminBalance(bal);
            setHistory(prev => ({ ...prev, ton: [...prev.ton.slice(1), Number(bal)] }));
        }
    } catch(e) { console.error("TON_SYNC_ERR"); }
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        const cpu = Number(update.core_load || 0);
        const lat = Number(update.network_latency || 0);
        const ram = Number(update.sync_memory || 0);
        const online = Number(update.active_agents || 0);
        const liq = Number(update.pulse_liquidity || 0);
        const h = Math.max(0, cfg.MATH.HEALTH_BASE - (cpu * cfg.MATH.CPU_WEIGHT) - (lat * cfg.MATH.LATENCY_WEIGHT)).toFixed(cfg.MATH.PRECISION);

        setStats({ cpu, ram, health: h, latency: lat, online, liquidity: liq });
        setHistory(prev => ({
          cpu: [...prev.cpu.slice(1), cpu],
          ram: [...prev.ram.slice(1), ram],
          online: [...prev.online.slice(1), online],
          liq: [...prev.liq.slice(1), liq],
          health: [...prev.health.slice(1), Number(h)],
          latency: [...prev.latency.slice(1), lat],
          ton: prev.ton
        }));
        setLastUpdate(new Date());
      } catch (err) {}
    };

    const treasuryInterval = setInterval(fetchTreasury, 60000);
    fetchTreasury();
    setTimeout(() => setIsLoaded(true), 600);
    return () => { eventSource.close(); clearInterval(treasuryInterval); };
  }, [fetchTreasury, cfg]);

  if (!isLoaded) return <div className="loading">SYNCING_NL4...</div>;

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        
        * { box-sizing: border-box; }
        .app-root { background: #000; min-height: 100vh; padding: 15px; font-family: 'Inter', sans-serif; color: #fff; max-width: 900px; margin: 0 auto; }
        
        /* HEADER RESPONSIVE */
        .header { display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; gap: 15px; margin-bottom: 25px; }
        @media (max-width: 600px) {
          .header { flex-direction: column; align-items: center; text-align: center; }
          .treasury-box { width: 100%; text-align: center !important; }
        }

        .nav-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 5px; }
        .tab-btn { background: none; border: none; color: #4a5568; padding: 10px 12px; font-size: 10px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; text-transform: uppercase; white-space: nowrap; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }

        /* GRID SYSTEM (Responsive) */
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 768px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 480px) { .stats-grid { grid-template-columns: 1fr; } }

        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 12px; position: relative; }
        .card-wide { grid-column: 1 / -1; }

        .controls-container { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        
        .cmd-btn { background: rgba(0,242,254,0.05); border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; font-size: 10px; padding: 12px; border-radius: 8px; cursor: pointer; font-family: 'Roboto Mono'; flex: 1; min-width: 100px; }
        .action-btn { background: transparent; border: 1px solid ${CYBER.primary}; color: ${CYBER.primary}; font-size: 10px; padding: 6px 10px; border-radius: 4px; cursor: pointer; }
        
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.2px; color: ${CYBER.subtext}; margin-bottom: 6px; }
        .val-main { font-size: 26px; font-weight: 700; font-family: 'Roboto Mono'; line-height: 1; }
        .val-unit { font-size: 11px; color: #4a5568; margin-left: 4px; }

        .table-responsive { width: 100%; overflow-x: auto; background: ${CYBER.card}; border-radius: 12px; border: 1px solid ${CYBER.border}; }
        .cyber-table { width: 100%; border-collapse: collapse; min-width: 500px; }
        .cyber-table th { padding: 15px; color: ${CYBER.subtext}; font-size: 10px; text-align: left; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 15px; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.02); }

        .terminal-box { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; height: 55vh; overflow-y: auto; padding: 15px; font-family: 'Roboto Mono'; font-size: 11px; line-height: 1.5; }
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; color: ${CYBER.primary}; background: #000; font-family: 'Roboto Mono'; font-size: 14px; }
        
        .treasury-box { background: rgba(0, 136, 204, 0.05); border: 1px solid ${CYBER.ton}; padding: 10px 15px; border-radius: 10px; text-align: right; }
      `}</style>

      <header className="header">
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '3px', color: CYBER.primary, margin: 0 }}>NEURAL_PULSE V11</h1>
          <div style={{ fontFamily: 'Roboto Mono', fontSize: '10px', color: CYBER.success, marginTop: '4px' }}>
            NODE_NL4 // STATUS: ACTIVE
          </div>
        </div>
        <div className="treasury-box">
          <div style={{ fontSize: '9px', color: CYBER.ton, fontWeight: 'bold' }}>TREASURY_RESERVE</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{adminBalance} <span style={{ fontSize: '12px', color: CYBER.ton }}>TON</span></div>
        </div>
      </header>

      <nav className="nav-tabs">
        {['overview', 'agents', 'shop', 'logs'].map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'overview' ? 'Monitor' : tab === 'agents' ? 'Database' : tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <>
          <KernelControls onLog={addLog} />
          <div className="stats-grid">
            <div className="card card-wide" style={{ textAlign: 'center' }}>
              <div className="label" style={{ color: CYBER.primary }}>System_Integrity</div>
              <div className="val-main" style={{ color: stats.health > 75 ? CYBER.success : CYBER.danger, fontSize: '40px' }}>{stats.health}%</div>
              <SparkGraph data={history.health} color={CYBER.primary} height={35} />
            </div>

            <div className="card">
              <div className="label">Core_Usage</div>
              <div className="val-main">{stats.cpu}<span className="val-unit">%</span></div>
              <SparkGraph data={history.cpu} color={CYBER.primary} />
            </div>

            <div className="card">
              <div className="label">Memory</div>
              <div className="val-main">{stats.ram}<span className="val-unit">MB</span></div>
              <SparkGraph data={history.ram} color={CYBER.secondary} />
            </div>

            <div className="card">
              <div className="label">Net_Delay</div>
              <div className="val-main" style={{ color: stats.latency > 150 ? CYBER.danger : CYBER.text }}>
                {stats.latency}<span className="val-unit">ms</span>
              </div>
              <SparkGraph data={history.latency} color={CYBER.danger} />
            </div>

            <div className="card">
              <div className="label">Active_Links</div>
              <div className="val-main">{stats.online}</div>
              <SparkGraph data={history.online} color={CYBER.success} />
            </div>

            <div className="card">
              <div className="label">NP_Liquidity</div>
              <div className="val-main">{Math.floor(stats.liquidity/1000)}k</div>
              <SparkGraph data={history.liq} color={CYBER.warning} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'agents' && <AgentsTable users={users} onLog={addLog} />}

      {activeTab === 'shop' && (
        <div className="card">
          <div className="label" style={{ marginBottom: '20px' }}>Market_Matrix</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {(cfg.SHOP?.PACKS || []).map(pack => (
              <div key={pack.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: pack.color, fontWeight: '900', fontSize: '12px' }}>{pack.name}</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', margin: '10px 0' }}>{pack.credits}</div>
                <div style={{ background: CYBER.ton, color: '#fff', fontSize: '10px', padding: '6px', borderRadius: '5px', fontWeight: 'bold' }}>{pack.price} TON</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="terminal-box">
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '6px', display: 'flex', gap: '8px' }}>
              <span style={{ color: CYBER.subtext }}>[{log.time}]</span>
              <span style={{ color: log.type === 'ERROR' ? CYBER.danger : log.type === 'SUCCESS' ? CYBER.success : CYBER.primary }}>
                {log.type === 'SUCCESS' ? '>>' : '>'}
              </span>
              <span style={{ color: log.type === 'ERROR' ? CYBER.danger : CYBER.text }}>{log.msg}</span>
            </div>
          ))}
        </div>
      )}

      <footer style={{ marginTop: '25px', textAlign: 'center', opacity: 0.3, fontSize: '9px', fontFamily: 'Roboto Mono' }}>
        PULSE_MONITOR_NL4 // BUILD_2026_04 // SYNC: {lastUpdate.toLocaleTimeString()}
      </footer>
    </div>
  );
};

export default Dashboard;
