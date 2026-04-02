import React, { useState, useEffect, memo, useMemo, useRef } from 'react';

// --- 🌌 OMNI-CYBER PALETTE V12.0 (GOD_MODE) ---
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
  border: 'rgba(0, 242, 254, 0.2)',
  glow: 'rgba(0, 242, 254, 0.4)',
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
      {/* Connection Paths */}
      <path d="M100 150 L400 50 L700 150 L400 250 Z" stroke={CYBER.primary} fill="none" strokeWidth="0.5" opacity="0.3" />
      <circle cx="100" cy="150" r="4" fill={CYBER.primary} filter="url(#neon-glow)">
        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="400" cy="50" r="4" fill={CYBER.accent} filter="url(#neon-glow)" />
      <circle cx="700" cy="150" r="4" fill={CYBER.success} filter="url(#neon-glow)" />
      <circle cx="400" cy="250" r="4" fill={CYBER.warning} filter="url(#neon-glow)" />
      
      {/* Moving Packets */}
      <circle r="2" fill="#fff">
        <animateMotion dur="3s" repeatCount="indefinite" path="M100 150 L400 50" />
      </circle>
      <circle r="2" fill="#fff">
        <animateMotion dur="4s" repeatCount="indefinite" path="M400 50 L700 150" />
      </circle>
    </svg>
  </div>
));

// --- 📈 SPARK GRAPH ---
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
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} />
    </svg>
  );
});

// --- 💎 QUANTUM CARD ---
const AnalyticCard = ({ label, value, unit, data, color, trend }) => (
  <div className="quantum-card">
    <div className="q-label" style={{ color }}>{label}</div>
    <div className="q-val">
      {typeof value === 'number' ? value.toLocaleString() : value}
      <span className="q-unit">{unit}</span>
    </div>
    <SparkGraph data={data} color={color} />
    <div className="card-decoration"></div>
  </div>
);

// --- 🛠️ MAIN DASHBOARD ---
const Dashboard = ({ data: initialData }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isBooting, setIsBooting] = useState(true);
  const [logs, setLogs] = useState([]);
  const [command, setCommand] = useState('');
  const [stats, setStats] = useState({ cpu: 0, ram: 0, online: 0, health: 100 });
  const [history, setHistory] = useState({ cpu: Array(20).fill(0), health: Array(20).fill(100) });

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
      setStats({ cpu: d.core_load, ram: d.sync_memory, online: d.active_agents, health: (100 - d.core_load/2).toFixed(1) });
      setHistory(p => ({
        cpu: [...p.cpu.slice(1), d.core_load],
        health: [...p.health.slice(1), (100 - d.core_load/2)]
      }));
    };

    return () => { eventSource.close(); clearTimeout(timer); };
  }, []);

  if (isBooting) {
    return (
      <div className="boot-container">
        <div className="glitch-text" data-text="GOD_MODE_ACTIVE">GOD_MODE_ACTIVE</div>
        <div className="boot-loader"></div>
        <div className="boot-log">ENCRYPTING_SESSION // BY_KANDERKANDER</div>
      </div>
    );
  }

  return (
    <div className="omni-app">
      <NeuralBackground />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&family=JetBrains+Mono:wght@300;700&display=swap');
        
        body { margin: 0; background: ${CYBER.bg}; color: ${CYBER.text}; font-family: 'JetBrains Mono', monospace; }
        .omni-app { min-height: 100vh; padding: 40px; position: relative; z-index: 1; }
        
        .boot-container { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; font-family: 'Orbitron'; }
        .boot-loader { width: 200px; height: 2px; background: ${CYBER.primary}; margin: 20px 0; animation: loading 2s infinite; }
        @keyframes loading { 0% { width: 0; opacity: 0; } 50% { width: 200px; opacity: 1; } 100% { width: 0; opacity: 0; } }

        .omni-header { display: flex; justify-content: space-between; border-bottom: 1px solid ${CYBER.border}; padding-bottom: 20px; margin-bottom: 40px; }
        .omni-logo { font-family: 'Orbitron'; font-weight: 900; font-size: 24px; letter-spacing: 2px; }
        .omni-logo span { color: ${CYBER.primary}; text-shadow: 0 0 15px ${CYBER.glow}; }

        .omni-grid { display: grid; grid-template-columns: 2.5fr 1fr; gap: 30px; }
        .quantum-card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 25px; border-radius: 4px; position: relative; backdrop-filter: blur(15px); }
        .q-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
        .q-val { font-family: 'Orbitron'; font-size: 38px; color: ${CYBER.primary}; }
        .q-unit { font-size: 14px; margin-left: 8px; opacity: 0.5; }

        .topology-container { height: 200px; border: 1px solid ${CYBER.border}; margin-bottom: 30px; border-radius: 4px; background: rgba(0,0,0,0.5); overflow: hidden; position: relative; }
        .map-overlay { position: absolute; top: 10px; left: 10px; font-size: 8px; color: ${CYBER.primary}; }
        .topology-svg { width: 100%; height: 100%; }

        .terminal-box { background: rgba(0,0,0,0.8); border: 1px solid ${CYBER.border}; height: 300px; display: flex; flex-direction: column; }
        .terminal-content { flex: 1; padding: 15px; overflow-y: auto; font-size: 11px; }
        .log-entry { margin-bottom: 5px; }
        .type-success { color: ${CYBER.success}; }
        .type-info { color: ${CYBER.info}; }
        .command-input { background: none; border: none; border-top: 1px solid ${CYBER.border}; padding: 15px; color: ${CYBER.primary}; font-family: 'JetBrains Mono'; outline: none; }

        .omni-tabs { display: flex; gap: 20px; margin-bottom: 30px; }
        .omni-tab { background: none; border: 1px solid ${CYBER.border}; color: ${CYBER.subtext}; padding: 8px 20px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; transition: 0.3s; }
        .omni-tab.active { background: ${CYBER.primary}; color: #000; box-shadow: 0 0 15px ${CYBER.glow}; }

        .neural-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; }
        .node-particle { position: absolute; width: 2px; height: 2px; background: ${CYBER.primary}; border-radius: 50%; animation: pulseNode 5s infinite; }
        @keyframes pulseNode { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.8; transform: scale(3); } }
        .scan-line-global { position: absolute; width: 100%; height: 2px; background: rgba(0, 242, 254, 0.1); animation: scanMove 8s infinite linear; }
        @keyframes scanMove { from { top: -10%; } to { top: 110%; } }
      `}</style>

      <header className="omni-header">
        <div className="omni-logo">NEURAL_PULSE // <span>GOD_MODE</span></div>
        <div style={{ textAlign: 'right', fontSize: '10px' }}>
          <div style={{ color: CYBER.success }}>SYS_INTEGRITY: 100%</div>
          <div style={{ opacity: 0.5 }}>{new Date().toLocaleTimeString()}</div>
        </div>
      </header>

      <nav className="omni-tabs">
        <button className={`omni-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>DASHBOARD</button>
        <button className={`omni-tab ${activeTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveTab('terminal')}>QUANTUM_CONSOLE</button>
      </nav>

      <div className="omni-grid">
        <div className="main-section">
          {activeTab === 'overview' && (
            <>
              <TopologyMap />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <AnalyticCard label="Global_Stability" value={stats.health} unit="%" data={history.health} color={CYBER.primary} />
                <AnalyticCard label="Neural_Load" value={stats.cpu} unit="%" data={history.cpu} color={CYBER.accent} />
              </div>
            </>
          )}

          {activeTab === 'terminal' && (
            <div className="terminal-box">
              <div className="terminal-content">
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

        <aside className="sidebar">
          <div className="quantum-card" style={{ marginBottom: '20px' }}>
            <div className="q-label">Active_Agents</div>
            <div className="q-val" style={{ fontSize: '28px' }}>{stats.online}</div>
            <div style={{ fontSize: '9px', marginTop: '10px', color: CYBER.success }}>CONNECTION: SECURE</div>
          </div>
          <div className="quantum-card">
            <div className="q-label">Node_Location</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: CYBER.primary }}>NETHERLANDS_NODE_01</div>
            <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '5px' }}>IP: 185.XXX.XXX.42</div>
          </div>
        </aside>
      </div>

      <footer style={{ marginTop: '50px', borderTop: `1px solid ${CYBER.border}`, padding: '20px 0', fontSize: '9px', opacity: 0.3, display: 'flex', justifyContent: 'space-between' }}>
        <div>V12.0_GOD_MODE_EDITION // CRYPTO_NEURAL_OPERATIONS</div>
        <div>AUTHORIZED_ACCESS_ONLY // USER: KANDERKANDER</div>
      </footer>
    </div>
  );
};

export default Dashboard;
