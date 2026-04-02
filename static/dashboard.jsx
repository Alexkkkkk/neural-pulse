import React, { useState, useEffect, memo, useMemo, useRef } from 'react';

// --- 🌌 OMNI-CYBER PALETTE V12.5 (SCREENSHOT_MATCH) ---
const CYBER = {
  bg: '#000103',
  card: 'rgba(10, 15, 25, 0.85)',
  primary: '#00f2fe',
  accent: '#bc13fe',
  ton: '#0088CC',
  success: '#00ff9f',
  danger: '#ff0055',
  warning: '#f3ff00',
  info: '#00d4ff',
  text: '#ffffff',
  subtext: '#8892b0',
  border: 'rgba(0, 242, 254, 0.15)',
  glow: 'rgba(0, 242, 254, 0.3)',
};

// --- ✨ NEURAL BACKGROUND V2 ---
const NeuralBackground = memo(() => (
  <div className="neural-bg">
    {[...Array(30)].map((_, i) => (
      <div key={i} className="node-particle" style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 8}s`,
        opacity: Math.random() * 0.5
      }} />
    ))}
    <div className="scan-line-global"></div>
  </div>
));

// --- 🛰️ NETWORK TOPOLOGY MAP ---
const TopologyMap = memo(() => (
  <div className="topology-container">
    <div className="map-overlay">REALTIME_NET_TOPOLOGY // LOC: AMS_01</div>
    <svg viewBox="0 0 800 300" className="topology-svg">
      <defs>
        <filter id="neon-glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path d="M100 150 L400 50 L700 150 L400 250 Z" stroke={CYBER.primary} fill="none" strokeWidth="0.5" opacity="0.3" />
      <circle cx="100" cy="150" r="4" fill={CYBER.primary} filter="url(#neon-glow)">
        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="400" cy="50" r="4" fill={CYBER.accent} filter="url(#neon-glow)" />
      <circle cx="700" cy="150" r="4" fill={CYBER.success} filter="url(#neon-glow)" />
      <circle cx="400" cy="250" r="4" fill={CYBER.warning} filter="url(#neon-glow)" />
      
      <circle r="2" fill="#fff">
        <animateMotion dur="3s" repeatCount="indefinite" path="M100 150 L400 50" />
      </circle>
      <circle r="2" fill="#fff">
        <animateMotion dur="4s" repeatCount="indefinite" path="M400 50 L700 150" />
      </circle>
    </svg>
  </div>
));

// --- 📈 NEON SPARK GRAPH ---
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
  return (
    <svg width="100%" height={height} style={{ overflow: 'visible', filter: `drop-shadow(0 0 5px ${color})` }}>
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} />
    </svg>
  );
});

// --- 💎 SYSTEM DATA CARD (Exact Screenshot Match) ---
const AnalyticCard = ({ label, value, unit, data, color }) => (
  <div className="quantum-card">
    <div className="card-inner">
      <div className="card-header-row">
        <span className="q-label" style={{ color }}>{label}</span>
        <span className="q-val">
          {typeof value === 'number' ? value.toLocaleString() : value}
          <span className="q-unit">{unit}</span>
        </span>
      </div>
      <SparkGraph data={data} color={color} />
    </div>
  </div>
);

// --- 🛠️ MAIN DASHBOARD ---
const Dashboard = ({ data: initialData }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isBooting, setIsBooting] = useState(true);
  const [logs, setLogs] = useState([]);
  const [command, setCommand] = useState('');
  
  const [stats, setStats] = useState({ cpu: 0, ram: 0, online: 0, stability: 100, wallet: 0 });
  const [history, setHistory] = useState({
    cpu: Array(20).fill(0),
    ram: Array(20).fill(0),
    stab: Array(20).fill(100)
  });

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }].slice(-50));
  };

  const handleCommand = (e) => {
    if (e.key === 'Enter' && command) {
      addLog(`> EXEC: ${command}`, 'info');
      if (command === '/clear') setLogs([]);
      if (command === '/reboot') window.location.reload();
      setCommand('');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
      addLog("GOD_MODE_KERNEL_LOADED", "success");
      addLog("SYNCING_WITH_BLOCKCHAIN_NODES...", "info");
    }, 2500);
    
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      const d = JSON.parse(e.data);
      setStats({ 
        cpu: d.core_load, 
        ram: d.sync_memory, 
        online: d.active_agents, 
        stability: (100 - d.core_load/4).toFixed(0),
        wallet: d.ton_reserve || 0
      });
      setHistory(p => ({
        cpu: [...p.cpu.slice(1), d.core_load],
        ram: [...p.ram.slice(1), d.sync_memory],
        stab: [...p.stab.slice(1), (100 - d.core_load/4)]
      }));
    };

    return () => { eventSource.close(); clearTimeout(timer); };
  }, []);

  if (isBooting) {
    return (
      <div className="boot-container">
        <div className="glitch-text" data-text="NEURAL_PULSE_V9.8">NEURAL_PULSE_V9.8</div>
        <div className="boot-loader"></div>
        <div className="boot-log">AUTHORIZED_ACCESS // USER: KANDERKANDER</div>
      </div>
    );
  }

  return (
    <div className="omni-app">
      <NeuralBackground />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&family=JetBrains+Mono:wght@300;700&display=swap');
        
        body { margin: 0; background: ${CYBER.bg}; color: ${CYBER.text}; font-family: 'JetBrains Mono', monospace; }
        .omni-app { min-height: 100vh; padding: 20px; max-width: 1200px; margin: 0 auto; position: relative; z-index: 1; }
        
        .boot-container { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; font-family: 'Orbitron'; }
        .boot-loader { width: 200px; height: 2px; background: ${CYBER.primary}; margin: 20px 0; animation: loading 2s infinite; }
        @keyframes loading { 0% { width: 0; opacity: 0; } 50% { width: 200px; opacity: 1; } 100% { width: 0; opacity: 0; } }

        .omni-header { margin-bottom: 30px; padding: 20px 0; }
        .omni-logo { font-family: 'Orbitron'; font-weight: 900; font-size: 26px; letter-spacing: 2px; color: ${CYBER.primary}; }
        .status-badge { font-size: 10px; color: ${CYBER.success}; margin-top: 5px; display: flex; align-items: center; gap: 8px; }
        .dot-pulse { width: 6px; height: 6px; background: ${CYBER.success}; border-radius: 50%; box-shadow: 0 0 8px ${CYBER.success}; }

        .omni-tabs { display: flex; gap: 30px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 30px; }
        .omni-tab { background: none; border: none; color: ${CYBER.subtext}; padding: 12px 0; cursor: pointer; font-family: 'Orbitron'; font-size: 11px; position: relative; transition: 0.3s; }
        .omni-tab.active { color: ${CYBER.primary}; }
        .omni-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: ${CYBER.primary}; box-shadow: 0 0 10px ${CYBER.primary}; }

        .quantum-card { background: rgba(13, 18, 28, 0.7); border: 1px solid ${CYBER.border}; padding: 20px; border-radius: 12px; margin-bottom: 15px; backdrop-filter: blur(10px); }
        .card-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
        .q-label { font-size: 10px; text-transform: uppercase; font-weight: bold; }
        .q-val { font-family: 'Orbitron'; font-size: 22px; }
        .q-unit { font-size: 12px; margin-left: 5px; opacity: 0.5; }

        .topology-container { height: 180px; border: 1px solid ${CYBER.border}; margin-bottom: 25px; border-radius: 12px; background: rgba(0,0,0,0.4); overflow: hidden; position: relative; }
        .map-overlay { position: absolute; top: 10px; left: 10px; font-size: 8px; color: ${CYBER.primary}; }

        .terminal-box { background: #000; border: 1px solid ${CYBER.border}; border-radius: 8px; height: 280px; display: flex; flex-direction: column; overflow: hidden; }
        .terminal-content { flex: 1; padding: 15px; overflow-y: auto; font-size: 11px; }
        .log-entry { margin-bottom: 4px; }
        .type-success { color: ${CYBER.success}; }
        .command-input { background: rgba(255,255,255,0.03); border: none; border-top: 1px solid ${CYBER.border}; padding: 12px; color: ${CYBER.primary}; font-family: 'JetBrains Mono'; outline: none; }

        .neural-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; }
        .node-particle { position: absolute; width: 2px; height: 2px; background: ${CYBER.primary}; border-radius: 50%; animation: pulseNode 5s infinite; }
        @keyframes pulseNode { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.6; transform: scale(2); } }
      `}</style>

      <header className="omni-header">
        <div className="omni-logo">NEURAL_PULSE V9.8</div>
        <div className="status-badge">
          <div className="dot-pulse"></div>
          SYSTEM_OPERATIONAL // SECURE_LINK_V4 // LOC: NL4
        </div>
      </header>

      <nav className="omni-tabs">
        <button className={`omni-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>OVERVIEW</button>
        <button className={`omni-tab ${activeTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveTab('terminal')}>QUANTUM_CONSOLE</button>
      </nav>

      <div className="main-layout">
        {activeTab === 'overview' && (
          <>
            <TopologyMap />
            <div className="stats-stack">
              <AnalyticCard label="Core_Node_Load" value={stats.cpu} unit="%" data={history.cpu} color={CYBER.primary} />
              <AnalyticCard label="Sync_Memory" value={stats.ram} unit="MB" data={history.ram} color={CYBER.accent} />
              <AnalyticCard label="Stability" value={stats.stability} unit="%" data={history.stab} color={CYBER.warning} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <div className="quantum-card">
                <div className="q-label" style={{ color: CYBER.success }}>Active_Agents</div>
                <div className="q-val" style={{ fontSize: '32px' }}>{stats.online} <span style={{fontSize: '12px', opacity: 0.5}}>USERS</span></div>
                <div style={{ height: '4px', background: 'rgba(0,255,159,0.1)', borderRadius: '2px', marginTop: '10px' }}>
                   <div style={{ height: '100%', width: '45%', background: CYBER.success, boxShadow: `0 0 10px ${CYBER.success}` }}></div>
                </div>
              </div>
              <div className="quantum-card">
                <div className="q-label" style={{ color: CYBER.ton }}>TON_Reserve</div>
                <div className="q-val" style={{ fontSize: '32px' }}>{stats.wallet.toFixed(1)} <span style={{fontSize: '12px', opacity: 0.5}}>TON</span></div>
                 <div style={{ height: '4px', background: 'rgba(0,136,204,0.1)', borderRadius: '2px', marginTop: '10px' }}>
                   <div style={{ height: '100%', width: '60%', background: CYBER.ton, boxShadow: `0 0 10px ${CYBER.ton}` }}></div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'terminal' && (
          <div className="terminal-box">
            <div className="terminal-content">
              <div className="log-entry type-success">[SYSTEM] Neural Core Sync Established.</div>
              <div className="log-entry">[IDLE] Monitoring blockchain nodes...</div>
              {logs.map((l, i) => (
                <div key={i} className={`log-entry type-${l.type}`}>
                  [{l.time}] {l.msg}
                </div>
              ))}
            </div>
            <input 
              className="command-input" 
              placeholder="AWAITING COMMAND..." 
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleCommand}
            />
          </div>
        )}
      </div>

      <footer style={{ marginTop: '40px', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '9px', opacity: 0.3, display: 'flex', justifyContent: 'space-between' }}>
        <div>V12.5_STABLE // CRYPTO_NEURAL_OPERATIONS</div>
        <div>OPERATOR: KANDERKANDER</div>
      </footer>
    </div>
  );
};

export default Dashboard;
