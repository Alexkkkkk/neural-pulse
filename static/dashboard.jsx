import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 NEURAL_PULSE SUPREME PALETTE ---
const CYBER = {
  bg: '#020406',
  card: '#0a0e14',
  primary: '#00f2fe',    
  secondary: '#7000ff', 
  success: '#39ff14',   
  warning: '#ffea00',   
  danger: '#ff003c',    
  ton: '#0088CC',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: '#1a1f26',
};

// --- 📊 DYNAMIC RESOURCE BAR ---
const ResourceBar = ({ label, value, color, unit = '%' }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px', textTransform: 'uppercase', opacity: 0.8 }}>
      <span>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}{unit}</span>
    </div>
    <div style={{ width: '100%', height: '4px', background: '#161925', borderRadius: '2px', overflow: 'hidden' }}>
      <div 
        style={{ 
          width: `${Math.min(value, 100)}%`, 
          height: '100%', 
          background: color, 
          boxShadow: `0 0 10px ${color}66`, 
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' 
        }} 
      />
    </div>
  </div>
);

const Dashboard = (props) => {
  const { data } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const logRef = useRef(null);

  // --- EXTENDED ANALYTICS STATE ---
  const [logs, setLogs] = useState(['> SYSTEM_BOOT_COMPLETE', '> ALL_MODULES_OPERATIONAL']);
  const [users, setUsers] = useState(data?.usersList || []);
  const [stats, setStats] = useState({
    cpu: 14,
    mem: 38,
    disk: 22,
    lat: 45,
    online_agents: 0,
    db_total_users: data?.totalUsers || 0,
    db_total_wallets: 0,
    active_wallets: 0,
    liquidity: data?.totalBalance || 0
  });

  const [history, setHistory] = useState({
    cpu: Array(15).fill(10),
    lat: Array(15).fill(40)
  });

  // --- 🛰️ SUPREME REAL-TIME ENGINE ---
  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        
        if (update.event_type === 'SYSTEM') {
          setStats(prev => ({
            ...prev,
            cpu: update.server_load * 10 ?? prev.cpu,
            mem: Math.round((update.mem_usage / 512) * 100) || prev.mem,
            online_agents: update.user_count ?? prev.online_agents,
            active_wallets: update.active_wallets ?? prev.active_wallets,
            liquidity: update.total_liquidity ?? prev.liquidity,
            lat: update.db_latency ?? prev.lat
          }));
          
          setHistory(prev => ({
            cpu: [...prev.cpu.slice(1), update.server_load * 10],
            lat: [...prev.lat.slice(1), update.db_latency],
          }));
        }

        if (update.event_type === 'USER_UPDATE' || update.event_type === 'TRANSACTION') {
          setUsers(prev => {
            const idx = prev.findIndex(u => u.id === update.user_data.id);
            if (idx !== -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...update.user_data };
              return copy;
            }
            // Если новый пользователь — инкрементим общую базу
            setStats(s => ({...s, db_total_users: s.db_total_users + 1}));
            return [update.user_data, ...prev];
          });
        }

        if (update.recent_event) {
          setLogs(prev => [...prev.slice(-12), `> ${new Date().toLocaleTimeString()}: ${update.recent_event}`]);
        }
      } catch (err) { console.error("Pulse Error:", err); }
    };

    setTimeout(() => setIsLoaded(true), 600);
    return () => eventSource.close();
  }, []);

  if (!isLoaded) return (
    <div style={{ background: '#000', height: '100vh', color: CYBER.primary, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <div style={{ marginBottom: '10px', letterSpacing: '5px' }}>INITIALIZING_TITAN_CORE</div>
      <div style={{ width: '200px', height: '2px', background: '#111', position: 'relative' }}>
        <div style={{ position: 'absolute', height: '100%', background: CYBER.primary, width: '60%', boxShadow: `0 0 15px ${CYBER.primary}` }}></div>
      </div>
    </div>
  );

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; transition: 0.5s; }
        .header-main { margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid ${CYBER.border}; padding-bottom: 20px; }
        .title-box h1 { color: ${CYBER.primary}; font-size: 26px; font-weight: 900; margin: 0; letter-spacing: 2px; }
        .grid-master { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 20px; border-radius: 4px; position: relative; overflow: hidden; }
        .card::after { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(90deg, transparent, ${CYBER.primary}33, transparent); }
        
        .stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; }
        .big-val { font-size: 28px; font-weight: bold; color: #fff; line-height: 1; }
        .label-micro { font-size: 9px; color: ${CYBER.primary}; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        
        .emergency { filter: grayscale(1) sepia(1) hue-rotate(-50deg) brightness(0.8); }
        .badge-live { display: flex; align-items: center; gap: 6px; font-size: 9px; color: ${CYBER.success}; }
        .dot { width: 6px; height: 6px; background: ${CYBER.success}; border-radius: 50%; animation: blink 1s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
      `}</style>

      {/* HEADER AREA */}
      <header className="header-main">
        <div className="title-box">
          <h1>NEURAL_PULSE <span style={{fontSize: '10px', verticalAlign: 'middle', opacity: 0.4}}>v9.9.2</span></h1>
          <div style={{ fontSize: '9px', opacity: 0.4, marginTop: '5px' }}>ROOT@TITAN_NODE_01 // SECURE_ENCRYPTED_SESSION</div>
        </div>
        <div className="badge-live">
          <div className="dot"></div>
          UPLINK_ESTABLISHED
        </div>
      </header>

      <div className="grid-master">
        {/* RESOURCE MONITORING */}
        <div className="card">
          <div className="label-micro">System_Hardware_Telemetry</div>
          <div style={{ marginTop: '15px' }}>
            <ResourceBar label="Kernel_CPU_Load" value={stats.cpu} color={CYBER.primary} />
            <ResourceBar label="Physical_Memory" value={stats.mem} color={CYBER.secondary} />
            <ResourceBar label="SSD_Storage_Pool" value={stats.disk} color={CYBER.warning} />
          </div>
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span style={{ opacity: 0.5 }}>I/O_LATENCY:</span>
            <span style={{ color: stats.lat > 100 ? CYBER.danger : CYBER.success }}>{stats.lat}ms</span>
          </div>
        </div>

        {/* POPULATION & WALLETS */}
        <div className="card">
          <div className="label-micro">Network_Density_Analysis</div>
          <div className="stat-row">
            <div>
              <div className="label-micro">Agents_In_DB</div>
              <div className="big-val">{stats.db_total_users}</div>
            </div>
            <div>
              <div className="label-micro" style={{color: CYBER.success}}>Agents_Online</div>
              <div className="big-val" style={{color: CYBER.success}}>{stats.online_agents}</div>
            </div>
          </div>
          <div className="stat-row" style={{ marginTop: '20px', borderTop: `1px solid ${CYBER.border}`, paddingTop: '15px' }}>
            <div>
              <div className="label-micro">Wallets_Registered</div>
              <div className="big-val" style={{color: CYBER.ton}}>{users.filter(u => u.wallet).length}</div>
            </div>
            <div>
              <div className="label-micro" style={{color: CYBER.primary}}>Wallets_Active</div>
              <div className="big-val" style={{color: CYBER.primary}}>{stats.active_wallets}</div>
            </div>
          </div>
        </div>

        {/* LIQUIDITY MONITOR */}
        <div className="card" style={{ background: `linear-gradient(135deg, ${CYBER.card} 0%, #0d121d 100%)` }}>
          <div className="label-micro">Global_Network_Liquidity</div>
          <div style={{ margin: '15px 0' }}>
            <div style={{ fontSize: '36px', fontWeight: '900', color: CYBER.primary }}>
              {stats.liquidity.toLocaleString()}
              <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.5 }}>$NP</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ padding: '2px 8px', background: `${CYBER.ton}22`, border: `1px solid ${CYBER.ton}44`, borderRadius: '2px', fontSize: '8px', color: CYBER.ton }}>TON_MAINNET</div>
            <div style={{ padding: '2px 8px', background: `${CYBER.success}22`, border: `1px solid ${CYBER.success}44`, borderRadius: '2px', fontSize: '8px', color: CYBER.success }}>SYNC_STABLE</div>
          </div>
        </div>
      </div>

      {/* AGENT REGISTRY & LOGS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '15px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div className="label-micro">Advanced_Agent_Registry</div>
            <input 
              className="search-input"
              style={{ background: '#000', border: `1px solid ${CYBER.border}`, color: CYBER.primary, padding: '5px 10px', fontSize: '10px', outline: 'none', width: '180px' }}
              placeholder="FILTER_ID_OR_NAME..."
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: CYBER.card, zIndex: 1 }}>
                <tr style={{ color: CYBER.primary, textAlign: 'left', fontSize: '9px' }}>
                  <th style={{ padding: '12px 8px', borderBottom: `1px solid ${CYBER.border}` }}>AGENT_ID</th>
                  <th style={{ padding: '12px 8px', borderBottom: `1px solid ${CYBER.border}` }}>BALANCE</th>
                  <th style={{ padding: '12px 8px', borderBottom: `1px solid ${CYBER.border}` }}>WALLET_ADDRESS</th>
                  <th style={{ padding: '12px 8px', borderBottom: `1px solid ${CYBER.border}` }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => String(u.username || u.id).toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1a1f2644', opacity: u.status === 'banned' ? 0.4 : 1 }}>
                    <td style={{ padding: '12px 8px', color: '#fff', fontWeight: 'bold' }}>{u.username || u.id}</td>
                    <td style={{ padding: '12px 8px', color: CYBER.success }}>{Number(u.balance || 0).toLocaleString()} <span style={{fontSize: '8px', opacity: 0.3}}>NP</span></td>
                    <td style={{ padding: '12px 8px', fontSize: '9px', fontFamily: 'monospace', opacity: 0.6 }}>
                      {u.wallet ? `${u.wallet.slice(0, 6)}...${u.wallet.slice(-6)}` : 'NOT_LINKED'}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ color: u.status === 'banned' ? CYBER.danger : CYBER.success }}>
                        {u.status === 'banned' ? 'BANNED' : 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ background: '#000' }}>
          <div className="label-micro" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Realtime_System_Logs</span>
            <span style={{ color: CYBER.danger }}>● RECORDING</span>
          </div>
          <div ref={logRef} style={{ height: '330px', overflowY: 'auto', fontSize: '10px', marginTop: '15px', color: CYBER.primary, opacity: 0.7, lineHeight: '1.6' }}>
            {logs.map((l, i) => (
              <div key={i} style={{ marginBottom: '6px', borderLeft: `1px solid ${CYBER.primary}44`, paddingLeft: '10px' }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer style={{ marginTop: '20px', textAlign: 'center', fontSize: '8px', opacity: 0.2, letterSpacing: '4px' }}>
        DECRYPT_TOKEN: {Math.random().toString(36).substring(7).toUpperCase()} // NEURAL_PULSE_MONITOR_OS
      </footer>
    </div>
  );
};

export default Dashboard;
