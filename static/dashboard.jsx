import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

// --- 🌌 ЦВЕТОВАЯ ПАЛИТРА (CYBER V11.6) ---
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

// ВАШ АДРЕС ДЛЯ МОНИТОРИНГА (ОБНОВЛЕНО)
const ADMIN_WALLET = "UQBo0iou1BlB_8Xg0Hn_rUeIcrpyyhoboIauvnii889OFRoI"; 

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
    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
      <button className="cmd-btn" onClick={() => execute('RESTART', 'NODE_REBOOT')}>🔄 RESTART</button>
      <button className="cmd-btn" onClick={() => execute('CLEAR_CACHE', 'MEM_CLEAN')}>🧹 PURGE_CACHE</button>
      <button className="cmd-btn" onClick={() => {
        const msg = prompt("SEND GLOBAL BROADCAST:");
        if(msg) sendCommand('BROADCAST', { msg }).then(() => onLog('BROADCAST_SENT', 'SUCCESS'));
      }}>📡 BROADCAST</button>
    </div>
  );
};

// --- 🗄️ ТАБЛИЦА АГЕНТОВ ---
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
    <div className="table-container">
      <table className="cyber-table">
        <thead>
          <tr><th>AGENT_ID</th><th>USERNAME</th><th>NP_BALANCE</th><th>WALLET_STATUS</th><th>ACTIONS</th></tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id || i}>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.subtext, fontSize: '10px' }}>{u.id}</td>
              <td style={{ color: CYBER.primary, fontWeight: 'bold' }}>@{u.username || 'UNKNOWN'}</td>
              <td style={{ fontFamily: 'Roboto Mono', color: CYBER.warning }}>{Number(u.balance || 0).toLocaleString()} NP</td>
              <td>
                {u.wallet ? (
                  <span className="status-badge" style={{ color: CYBER.ton, borderColor: CYBER.ton, background: 'rgba(0,136,204,0.1)' }}>
                    {u.wallet.slice(0, 4)}...{u.wallet.slice(-4)}
                  </span>
                ) : (
                  <span className="status-badge" style={{ opacity: 0.3 }}>NOT_CONNECTED</span>
                )}
              </td>
              <td><button className="action-btn" onClick={() => updateBalance(u)}>MANAGE</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- 🚀 ГЛАВНЫЙ ДАШБОРД (APEX V11.6 FIX) ---
const Dashboard = (props) => {
  const { data: initialData } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [adminBalance, setAdminBalance] = useState(0);
  const [userWallet, setUserWallet] = useState(null);

  const tonConnectUI = useRef(null);

  const cfg = useRef(window.PULSE_CONFIG || { 
    MATH: { HEALTH_BASE: 100, CPU_WEIGHT: 0.4, LATENCY_WEIGHT: 0.15, PRECISION: 1 }, 
    SHOP: { PACKS: [] } 
  }).current;

  const [users] = useState(initialData?.usersList || []);
  const [logs, setLogs] = useState([{ time: new Date().toLocaleTimeString(), msg: 'NEURAL_PULSE_OS_BOOT_OK', type: 'SUCCESS' }]);
  
  const [stats, setStats] = useState({ 
    cpu: 0, ram: 0, online: initialData?.totalUsers || 0, 
    ton: 0, latency: 0, liquidity: initialData?.totalBalance || 0, health: 100 
  });

  const [history, setHistory] = useState({
    cpu: Array(25).fill(0), ram: Array(25).fill(0), online: Array(25).fill(0), 
    liq: Array(25).fill(0), health: Array(25).fill(100), ton: Array(25).fill(0), 
    latency: Array(25).fill(0)
  });

  const addLog = useCallback((msg, type = 'INFO') => {
    setLogs(prev => [...prev.slice(-39), { time: new Date().toLocaleTimeString(), msg, type }]);
  }, []);

  // --- ИНИЦИАЛИЗАЦИЯ TON CONNECT (ИСПРАВЛЕНО: Добавлен интервал проверки SDK) ---
  useEffect(() => {
    const initTimer = setInterval(() => {
      if (window.TonConnectUI && !tonConnectUI.current) {
        try {
          tonConnectUI.current = new window.TonConnectUI.TonConnectUI({
            manifestUrl: `https://${window.location.host}/tonconnect-manifest.json`,
            buttonRootId: 'ton-connect-btn'
          });

          tonConnectUI.current.onStatusChange(wallet => {
            if (wallet) {
              setUserWallet(wallet.account.address);
              addLog('WALLET_LINKED: ' + wallet.account.address.slice(0, 8) + '...', 'SUCCESS');
            } else {
              setUserWallet(null);
              addLog('WALLET_DISCONNECTED', 'INFO');
            }
          });
          
          clearInterval(initTimer); // SDK Инициализирован успешно
        } catch (err) {
          console.error("SDK_INIT_ERROR", err);
        }
      }
    }, 500);

    return () => clearInterval(initTimer);
  }, [addLog]);

  const handleConnect = async () => {
    try {
        if (tonConnectUI.current) {
            await tonConnectUI.current.openModal();
        } else {
            addLog('TON_SDK_NOT_READY - RELOAD PAGE', 'ERROR');
        }
    } catch (err) {
        addLog('CONNECT_ABORTED', 'WARNING');
    }
  };

  // --- ПОЛУЧЕНИЕ БАЛАНСА (ИСПРАВЛЕНО: Используется tonapi.io для точности) ---
  const fetchTreasury = useCallback(async () => {
    try {
        const res = await fetch(`https://tonapi.io/v2/accounts/${ADMIN_WALLET}`);
        const json = await res.json();
        if(json && json.balance !== undefined) {
            const bal = (json.balance / 1e9).toFixed(4);
            setAdminBalance(bal);
            setHistory(prev => ({ ...prev, ton: [...prev.ton.slice(1), Number(bal)] }));
        }
    } catch(e) { 
        console.error("TON_SYNC_ERROR"); 
        addLog("TREASURY_SYNC_FAILED", "ERROR");
    }
  }, [addLog]);

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

        setStats(prev => ({ ...prev, cpu, ram, health: h, latency: lat, online, liquidity: liq }));
        
        setHistory(prev => ({
          ...prev,
          cpu: [...prev.cpu.slice(1), cpu],
          ram: [...prev.ram.slice(1), ram],
          online: [...prev.online.slice(1), online],
          liq: [...prev.liq.slice(1), liq],
          health: [...prev.health.slice(1), Number(h)],
          latency: [...prev.latency.slice(1), lat]
        }));
        
        setLastUpdate(new Date());
      } catch (err) { console.error("SSE_ERROR", err); }
    };

    const treasuryInterval = setInterval(fetchTreasury, 30000);
    fetchTreasury();

    const loader = setTimeout(() => setIsLoaded(true), 800);
    
    return () => {
      eventSource.close();
      clearInterval(treasuryInterval);
      clearTimeout(loader);
    };
  }, [addLog, cfg, fetchTreasury]);

  if (!isLoaded) return <div className="loading">CONNECTING_TO_NL4_NODE...</div>;

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono&display=swap');
        .app-root { background: #000; min-height: 100vh; padding: 20px; font-family: 'Inter', sans-serif; color: #fff; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; }
        .nav-tabs { display: flex; gap: 20px; margin: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tab-btn { background: none; border: none; color: #4a5568; padding: 10px 0; font-size: 11px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; text-transform: uppercase; transition: 0.3s; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; text-shadow: 0 0 10px ${CYBER.primary}88; }
        .cmd-btn { background: rgba(0,242,254,0.05); border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; font-size: 9px; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-family: 'Roboto Mono'; font-weight: bold; }
        .action-btn { background: transparent; border: 1px solid ${CYBER.primary}; color: ${CYBER.primary}; font-size: 9px; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-family: 'Roboto Mono'; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; border-radius: 12px; position: relative; overflow: hidden; }
        .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; color: ${CYBER.subtext}; }
        .val-main { font-size: 28px; font-weight: 700; display: flex; align-items: baseline; font-family: 'Roboto Mono'; }
        .val-unit { font-size: 10px; color: #4a5568; margin-left: 6px; }
        .table-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; overflow: hidden; }
        .cyber-table { width: 100%; border-collapse: collapse; text-align: left; }
        .cyber-table th { padding: 15px; color: ${CYBER.subtext}; font-size: 10px; border-bottom: 1px solid ${CYBER.border}; }
        .cyber-table td { padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.02); font-size: 12px; }
        .status-badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); }
        .terminal-container { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; height: 60vh; display: flex; flex-direction: column; overflow: hidden; }
        .terminal-body { padding: 15px; overflow-y: auto; flex: 1; font-family: 'Roboto Mono'; font-size: 11px; }
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; color: ${CYBER.primary}; font-family: 'Roboto Mono'; background: #000; }
        .shop-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
        .shop-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; text-align: center; transition: 0.3s; cursor: pointer; }
        .shop-card:hover { border-color: ${CYBER.primary}; background: rgba(0,242,254,0.05); transform: translateY(-3px); }
        .treasury-box { background: rgba(0, 136, 204, 0.05); border: 1px solid ${CYBER.ton}; padding: 8px 12px; border-radius: 8px; text-align: right; min-width: 140px; }
        .ton-connect-btn-styled { background: ${CYBER.ton}; border: none; color: #fff; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 11px; transition: 0.3s; border: 1px solid transparent; width: 100%; }
        .ton-connect-btn-styled:hover { filter: brightness(1.2); border-color: ${CYBER.primary}; }
        
        /* Модальное окно TonConnect поверх всего */
        tc-root { z-index: 10000 !important; }
      `}</style>

      <div className="header">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '4px', color: CYBER.primary }}>NEURAL_PULSE V11</h1>
          <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: CYBER.success, marginTop: '5px' }}>
            NODE_NL4: ACTIVE // PRO_PLAN
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <div className="treasury-box">
                {userWallet ? (
                  <>
                    <div style={{ fontSize: '8px', color: CYBER.ton, fontWeight: 'bold' }}>AGENT_WALLET_ACTIVE</div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: CYBER.primary, fontFamily: 'Roboto Mono' }}>
                      {userWallet.slice(0, 6)}...{userWallet.slice(-4)}
                    </div>
                  </>
                ) : (
                  <button className="ton-connect-btn-styled" onClick={handleConnect}>CONNECT_WALLET</button>
                )}
            </div>
            <div style={{ fontSize: '9px', color: CYBER.subtext, fontFamily: 'Roboto Mono' }}>SYNC: {lastUpdate.toLocaleTimeString()}</div>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>MONITOR</button>
        <button className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>AGENTS_DB</button>
        <button className={`tab-btn ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => setActiveTab('shop')}>PURCHASE</button>
        <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>TERMINAL</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <KernelControls onLog={addLog} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
            
            {/* ГЛАВНЫЙ ГРАФИК ЗДОРОВЬЯ */}
            <div className="card" style={{ gridColumn: 'span 2', textAlign: 'center' }}>
                <div className="label" style={{ color: CYBER.primary }}>System_Health</div>
                <div className="val-main" style={{ justifyContent: 'center', fontSize: '42px', color: stats.health > 70 ? CYBER.success : CYBER.danger }}>
                    {stats.health}<span className="val-unit" style={{ fontSize: '16px' }}>%</span>
                </div>
                <SparkGraph data={history.health} color={CYBER.primary} height={35} />
            </div>

            <div className="card">
                <div className="label">Core_Usage</div>
                <div className="val-main">{stats.cpu}<span className="val-unit">%</span></div>
                <SparkGraph data={history.cpu} color={CYBER.primary} />
            </div>

            <div className="card">
                <div className="label">Ram_Memory</div>
                <div className="val-main">{stats.ram}<span className="val-unit">MB</span></div>
                <SparkGraph data={history.ram} color={CYBER.secondary} />
            </div>

            <div className="card">
                <div className="label">Net_Latency</div>
                <div className="val-main" style={{ color: stats.latency > 150 ? CYBER.danger : CYBER.text }}>
                  {stats.latency}<span className="val-unit">ms</span>
                </div>
                <SparkGraph data={history.latency} color={CYBER.danger} />
            </div>

            <div className="card" style={{ borderColor: CYBER.ton }}>
                <div className="label" style={{ color: CYBER.ton }}>TON_Revenue</div>
                <div className="val-main">{adminBalance}<span className="val-unit">TON</span></div>
                <SparkGraph data={history.ton} color={CYBER.ton} />
            </div>

            <div className="card">
                <div className="label">Neural_Links</div>
                <div className="val-main">{stats.online}<span className="val-unit">ID</span></div>
                <SparkGraph data={history.online} color={CYBER.success} />
            </div>

            <div className="card">
                <div className="label">Liquidity</div>
                <div className="val-main">{Number(stats.liquidity).toLocaleString()}<span className="val-unit">$NP</span></div>
                <SparkGraph data={history.liq} color={CYBER.warning} />
            </div>

          </div>
        </>
      )}

      {activeTab === 'agents' && <AgentsTable users={users} onLog={addLog} />}

      {activeTab === 'shop' && (
        <div className="card">
          <div className="label" style={{ marginBottom: '20px' }}>Neural_Pulse_Marketplace</div>
          <div className="shop-grid">
            {(cfg.SHOP?.PACKS || []).map(pack => (
              <div key={pack.id} className="shop-card">
                <div style={{ color: pack.color, fontWeight: '900', fontSize: '12px', marginBottom: '10px' }}>{pack.name}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{pack.credits}</div>
                <div style={{ fontSize: '9px', opacity: 0.5, marginBottom: '15px' }}>$NP_CREDITS</div>
                <div style={{ background: CYBER.ton, color: '#fff', fontSize: '10px', padding: '6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {pack.price} TON
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {activeTab === 'logs' && (
        <div className="terminal-container">
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

      <div id="ton-connect-btn" style={{ display: 'none' }}></div>

      <footer style={{ marginTop: '30px', textAlign: 'center', opacity: 0.2, fontSize: '8px', fontFamily: 'Roboto Mono' }}>
        APEX_MONITOR_NL4 // BUILD_2026_04 // ROOT_ID: 1774594734
      </footer>
    </div>
  );
};

export default Dashboard;
