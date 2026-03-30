import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

// --- 🌌 INFINITY-PULSE CORE PALETTE (v8.5) ---
const CYBER = {
  bg: '#020406',
  card: 'rgba(6, 9, 13, 0.8)',
  primary: '#00f2fe',    
  secondary: '#7000ff', 
  success: '#39ff14',   
  warning: '#ffea00',   
  danger: '#ff003c',    
  ton: '#0088CC',
  text: '#e2e8f0',
  subtext: '#8b949e',
  border: 'rgba(0, 242, 254, 0.25)',
  hex: 'rgba(0, 242, 254, 0.03)'
};

// --- 🔉 QUANTUM AUDIO ENGINE ---
const playSound = (freq, type = 'sine', dur = 0.2) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (e) {}
};

// --- 📈 PRECISION MINI-CHART ---
const MiniChart = memo(({ data, color, height = 45 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const cleanData = data.map(v => (Number.isFinite(v) ? v : 0));
  const max = Math.max(...cleanData) || 1;
  const min = Math.min(...cleanData);
  const range = max - min || 1;
  const points = cleanData.map((val, i) => ({
    x: (i / (cleanData.length - 1)) * 100,
    y: height - ((val - min) / range) * height,
  }));
  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  return (
    <svg width="100%" height={height} style={{ marginTop: '12px', overflow: 'visible', filter: `drop-shadow(0 0 5px ${color}44)` }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.08" />
    </svg>
  );
});

// --- ⚡ NEURAL WAVE VISUALIZER ---
const NeuralWave = memo(({ active }) => (
  <svg viewBox="0 0 400 100" style={{ width: '100%', height: '80px', filter: `drop-shadow(0 0 10px ${active ? CYBER.danger : CYBER.primary})` }}>
    <path
      d="M0 50 Q 50 10, 100 50 T 200 50 T 300 50 T 400 50"
      fill="none"
      stroke={active ? CYBER.danger : CYBER.primary}
      strokeWidth="2"
    >
      <animate attributeName="d" dur="2s" repeatCount="indefinite"
        values="M0 50 Q 50 10, 100 50 T 200 50 T 300 50 T 400 50;
                M0 50 Q 50 90, 100 50 T 200 50 T 300 50 T 400 50;
                M0 50 Q 50 10, 100 50 T 200 50 T 300 50 T 400 50" />
    </path>
  </svg>
));

const Dashboard = (props) => {
  const [bootProgress, setBootProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [logs, setLogs] = useState(['> MOUNTING_ENCRYPTED_VOLUMES...', '> CONNECTING_TO_TON_GATEWAY...', '> PULSE_OS_v8_READY']);
  const [history, setHistory] = useState(props.data?.history || []);
  const [isEmergency, setIsEmergency] = useState(false);
  const [modal, setModal] = useState({ active: false, value: '' });
  const [actionLoading, setActionLoading] = useState(null);
  const logRef = useRef(null);

  const [stats, setStats] = useState({
    users: props.data?.totalUsers || 0,
    wallets: props.data?.active_wallets || 0,
    balance: props.data?.total_balance || 0,
    load: 0, mem: 0, lat: 0
  });

  const addLog = useCallback((msg, type = 'log') => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLogs(prev => [...prev.slice(-25), `[${time}] ${msg}`]);
    if (type === 'auth') playSound(1000);
    else if (type === 'error') playSound(200, 'sawtooth');
    else playSound(600);
  }, []);

  const executeAction = async (cmd, payload = {}) => {
    setActionLoading(cmd);
    addLog(`> INITIATING_PROTOCOL: ${cmd.toUpperCase()}`, 'cmd');
    try {
      const response = await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: cmd, ...payload })
      });
      if (response.ok) {
        addLog(`> PROTOCOL_${cmd.toUpperCase()}_EXECUTED`, 'success');
        if (cmd === 'maintenance') setIsEmergency(!isEmergency);
        setModal({ active: false, value: '' });
      } else throw new Error();
    } catch (e) { addLog(`> PROTOCOL_${cmd.toUpperCase()}_DENIED`, 'error'); }
    setActionLoading(null);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setBootProgress(p => {
        if (p >= 100) { clearInterval(timer); setTimeout(() => setIsLoaded(true), 400); return 100; }
        return p + 4;
      });
    }, 30);
    
    const es = new EventSource('/api/admin/stream');
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        setStats(p => ({ 
            ...p, 
            users: d.user_count ?? p.users, 
            load: d.server_load ?? p.load, 
            mem: d.mem_usage ?? p.mem, 
            balance: d.total_balance ?? p.balance,
            lat: d.db_latency ?? p.lat
        }));
        if (d.time) setHistory(prev => [...prev.slice(-40), d]);
        if (d.recent_event) {
          addLog(d.recent_event, d.event_type === 'AUTH' ? 'auth' : 'log');
        }
      } catch (err) {}
    };
    return () => { clearInterval(timer); es.close(); };
  }, [addLog]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const StatCard = ({ label, value, unit, color, historyKey }) => (
    <div className="glass-panel stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label" style={{ color }}>{label}</div>
          <div className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}<span style={{ fontSize: '12px', opacity: 0.5, marginLeft: '4px' }}>{unit}</span></div>
        </div>
      </div>
      <MiniChart data={history.map(h => Number(h[historyKey]) || 0)} color={color} />
    </div>
  );

  if (!isLoaded) return (
    <div className="boot-screen">
      <style>{`
        .boot-screen { background: #000; height: 100vh; display: flex; flex-direction: column; alignItems: center; justify-content: center; color: ${CYBER.primary}; font-family: monospace; }
        .boot-bar { width: 300px; height: 2px; background: #111; position: relative; margin: 20px auto; }
        .boot-fill { height: 100%; background: ${CYBER.primary}; transition: 0.3s; box-shadow: 0 0 15px ${CYBER.primary}; }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
      <div style={{ fontSize: '24px', letterSpacing: '10px', animation: 'pulse 1s infinite' }}>LOADING_PULSE_v8</div>
      <div className="boot-bar">
        <div className="boot-fill" style={{ width: `${bootProgress}%` }} />
      </div>
      <div style={{ fontSize: '10px', opacity: 0.5 }}>KERNEL_STAGING: {bootProgress}%</div>
    </div>
  );

  return (
    <div className={`app-root ${isEmergency ? 'emergency-mode' : ''}`}>
      <style>{`
        .app-root { 
          background: ${CYBER.bg}; min-height: 100vh; padding: 30px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text};
          position: relative; overflow-x: hidden; transition: 1s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .app-root::before {
          content: ""; position: fixed; inset: 0; pointer-events: none; opacity: 0.04;
          background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCA2MCAzMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMzAgMEw2MCAxNUwzMCAzMEwwIDE1TDMwIDBaIiBmaWxsPSJub25lIiBzdHJva2U9IiMwMGYyZmUiIHN0cm9rZS13aWR0aD0iMC41Ii8+PC9zdmc+');
        }
        .app-root::after {
          content: " "; position: fixed; inset: 0; pointer-events: none;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
          background-size: 100% 4px, 3px 100%; z-index: 100;
        }

        .emergency-mode { filter: hue-rotate(-160deg) saturate(1.5); }

        .glass-panel {
          background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 2px;
          backdrop-filter: blur(10px); position: relative; transition: 0.3s;
        }
        .glass-panel:hover { border-color: ${CYBER.primary}; box-shadow: 0 0 20px rgba(0, 242, 254, 0.1); }

        .stat-card { padding: 22px; }
        .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: 900; }
        .stat-value { font-size: 26px; font-weight: 900; margin-top: 8px; }

        .btn-cyber {
          background: transparent; border: 1px solid ${CYBER.primary}; color: ${CYBER.primary};
          padding: 12px; cursor: pointer; font-family: inherit; font-size: 10px; font-weight: bold;
          text-transform: uppercase; transition: 0.2s; clip-path: polygon(8% 0, 100% 0, 92% 100%, 0 100%);
        }
        .btn-cyber:hover:not(:disabled) { background: ${CYBER.primary}; color: #000; box-shadow: 0 0 15px ${CYBER.primary}; }
        .btn-cyber:disabled { opacity: 0.2; cursor: not-allowed; }
        
        .log-area { 
          height: 350px; overflow-y: auto; background: rgba(0,0,0,0.6); padding: 15px; 
          border: 1px solid ${CYBER.border}; font-size: 11px; line-height: 1.6;
        }
        .log-area::-webkit-scrollbar { width: 2px; }
        .log-area::-webkit-scrollbar-thumb { background: ${CYBER.primary}; }

        .modal-terminal {
          position: fixed; inset: 0; background: rgba(2, 4, 6, 0.98); z-index: 1000;
          display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);
        }
        .cyber-input {
          background: #000; border: 1px solid ${CYBER.primary}; color: ${CYBER.primary};
          width: 100%; padding: 15px; font-family: inherit; margin: 20px 0; outline: none; resize: none;
        }
      `}</style>

      {/* --- MODAL BROADCAST --- */}
      {modal.active && (
        <div className="modal-terminal" onClick={() => setModal({ active: false, value: '' })}>
          <div className="glass-panel" style={{ width: '450px', padding: '25px' }} onClick={e => e.stopPropagation()}>
            <div className="stat-label" style={{ color: CYBER.primary }}>📡 [BROADCAST_TRANSMISSION]</div>
            <textarea 
              className="cyber-input" 
              rows="4" 
              autoFocus
              value={modal.value}
              onChange={(e) => setModal({...modal, value: e.target.value})}
              placeholder="ENTER_PAYLOAD_DATA..."
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-cyber" style={{ flex: 1 }} onClick={() => executeAction('broadcast', { message: modal.value })} disabled={!modal.value || actionLoading}>SEND_SIGNAL</button>
              <button className="btn-cyber" style={{ borderColor: '#444', color: '#444' }} onClick={() => setModal({ active: false, value: '' })}>ABORT</button>
            </div>
          </div>
        </div>
      )}

      {/* --- TOP HUD --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', borderBottom: `1px solid ${CYBER.border}`, paddingBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '36px', letterSpacing: '12px', color: CYBER.primary, fontWeight: 900 }}>NEURAL_PULSE</h1>
          <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '8px' }}>
            // OS_KERNEL: v8.5_GENESIS // STATUS: <span style={{ color: isEmergency ? CYBER.danger : CYBER.success }}>{isEmergency ? 'HALTED' : 'OPERATIONAL'}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: CYBER.ton }}>{stats.balance.toLocaleString()} <span style={{ fontSize: '14px' }}>$NP</span></div>
          <div className="stat-label" style={{ color: CYBER.subtext }}>NETWORK_RESERVE_CONNECTED</div>
        </div>
      </div>

      {/* --- CORE TELEMETRY --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <StatCard label="AGENTS" value={stats.users} unit="U" color={CYBER.primary} historyKey="user_count" />
        <StatCard label="NODES" value={stats.wallets} unit="W" color={CYBER.ton} historyKey="active_wallets" />
        <StatCard label="CPU_LOAD" value={stats.load} unit="%" color={CYBER.success} historyKey="server_load" />
        <StatCard label="RAM_ALLOC" value={stats.mem} unit="MB" color={CYBER.warning} historyKey="mem_usage" />
        <StatCard label="LATENCY" value={stats.lat} unit="MS" color={CYBER.danger} historyKey="db_latency" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
        {/* --- COMMAND CENTER --- */}
        <div className="glass-panel" style={{ padding: '25px' }}>
          <div className="stat-label" style={{ marginBottom: '25px', color: CYBER.primary }}>SYSTEM_OPERATIONS_MATRIX</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <button className="btn-cyber" onClick={() => setModal({ active: true, value: '' })}>📢 BROADCAST</button>
            <button className="btn-cyber" onClick={() => executeAction('clear_cache')}>🧹 PURGE_CACHE</button>
            <button className="btn-cyber" onClick={() => executeAction('backup')}>💾 CLOUD_SYNC</button>
            <button className="btn-cyber" style={{ borderColor: CYBER.danger, color: CYBER.danger }} onClick={() => executeAction('maintenance')}>
              {isEmergency ? '▶️ RESUME' : '⚠️ KILL_SWITCH'}
            </button>
          </div>
          
          <div style={{ marginTop: '45px' }}>
            <div className="stat-label" style={{ marginBottom: '10px', opacity: 0.5 }}>OSCILLOSCOPE_STREAM</div>
            <NeuralWave active={isEmergency} />
          </div>
        </div>

        {/* --- LIVE KERNEL FEED --- */}
        <div className="log-area glass-panel">
          <div style={{ position: 'sticky', top: 0, background: CYBER.card, paddingBottom: '10px', color: CYBER.success, fontWeight: 'bold', fontSize: '10px', letterSpacing: '2px' }}>
            [LIVE_KERNEL_STDOUT]
          </div>
          {logs.map((l, i) => (
            <div key={i} style={{ 
              color: l.includes('DENIED') || l.includes('FAILED') ? CYBER.danger : l.includes('EXECUTED') ? CYBER.success : CYBER.text, 
              marginBottom: '6px', opacity: 0.9, borderLeft: `2px solid ${l.includes('EXECUTED') ? CYBER.success : 'transparent'}`, paddingLeft: '8px'
            }}>
              {l}
            </div>
          ))}
          <div ref={logRef} />
        </div>
      </div>

      {/* --- FOOTER --- */}
      <footer style={{ marginTop: '50px', textAlign: 'center', fontSize: '9px', letterSpacing: '6px', opacity: 0.2 }}>
        PROPERTY_OF_NEURAL_PULSE_NETWORK // ACCESS_LEVEL_ROOT // 2026
      </footer>
    </div>
  );
};

export default Dashboard;
