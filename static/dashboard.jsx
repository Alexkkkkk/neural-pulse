import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

// --- 🌌 INFINITY-PULSE CORE PALETTE (v8.6) ---
const CYBER = {
  bg: '#020406',
  card: 'rgba(6, 9, 13, 0.9)', // Немного плотнее для лучшей читаемости
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
const MiniChart = memo(({ data, color, height = 40 }) => {
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
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.08" />
    </svg>
  );
});

// --- ⚡ NEURAL WAVE VISUALIZER ---
const NeuralWave = memo(({ active }) => (
  <svg viewBox="0 0 400 100" style={{ width: '100%', height: '60px', opacity: 0.7 }}>
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
  const [logs, setLogs] = useState(['> MOUNTING_VOLUMES...', '> CONNECTING_TON...', '> PULSE_READY']);
  const [history, setHistory] = useState(props.data?.history || []);
  const [isEmergency, setIsEmergency] = useState(false);
  const [modal, setModal] = useState({ active: false, value: '' });
  const [actionLoading, setActionLoading] = useState(null);
  const logRef = useRef(null);

  const [stats, setStats] = useState({
    users: props.data?.totalUsers || 0,
    wallets: props.data?.active_wallets || 0,
    balance: props.data?.total_balance || 0,
    load: 12.7, mem: 420, lat: 106
  });

  const addLog = useCallback((msg, type = 'log') => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLogs(prev => [...prev.slice(-20), `[${time}] ${msg}`]);
    if (type === 'error') playSound(200, 'sawtooth');
    else playSound(600);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setBootProgress(p => {
        if (p >= 100) { clearInterval(timer); setTimeout(() => setIsLoaded(true), 300); return 100; }
        return p + 5;
      });
    }, 20);
    
    const es = new EventSource('/api/admin/stream');
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        setStats(p => ({ ...p, users: d.user_count ?? p.users, load: d.server_load ?? p.load, balance: d.total_balance ?? p.balance, lat: d.db_latency ?? p.lat }));
        if (d.time) setHistory(prev => [...prev.slice(-30), d]);
        if (d.recent_event) addLog(d.recent_event);
      } catch (err) {}
    };
    return () => { clearInterval(timer); es.close(); };
  }, [addLog]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  if (!isLoaded) return (
    <div style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: CYBER.primary, fontFamily: 'monospace' }}>
      <div style={{ letterSpacing: '5px', marginBottom: '15px' }}>BOOTING_NEURAL_PULSE</div>
      <div style={{ width: '200px', height: '2px', background: '#111' }}>
        <div style={{ width: `${bootProgress}%`, height: '100%', background: CYBER.primary, boxShadow: `0 0 10px ${CYBER.primary}` }} />
      </div>
    </div>
  );

  return (
    <div className={`app-root ${isEmergency ? 'emergency-mode' : ''}`}>
      <style>{`
        .app-root { 
          background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text};
          position: relative; overflow-x: hidden;
        }
        .app-root::after {
          content: ""; position: fixed; inset: 0; pointer-events: none; opacity: 0.05; z-index: 10;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02));
          background-size: 100% 3px, 2px 100%;
        }

        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; flex-wrap: wrap; gap: 10px; }
        .main-title { font-size: clamp(24px, 8vw, 42px); letter-spacing: 4px; color: ${CYBER.primary}; margin: 0; font-weight: 900; }
        
        /* Адаптивная сетка карточек */
        .stat-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
          gap: 12px; margin-bottom: 20px; 
        }
        .card { 
          background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; 
          border-radius: 2px; position: relative; transition: 0.3s;
        }
        .card:hover { border-color: ${CYBER.primary}; }
        .stat-label { font-size: 9px; color: ${CYBER.primary}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 5px; font-weight: bold; }
        .stat-value { font-size: 22px; font-weight: bold; }

        /* Секция управления */
        .control-section { display: grid; grid-template-columns: 1fr; gap: 15px; }
        @media (min-width: 900px) { .control-section { grid-template-columns: 1.4fr 1fr; } }

        .btn-matrix { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cyber-btn {
          background: rgba(0, 242, 254, 0.03); border: 1px solid ${CYBER.primary}; color: ${CYBER.primary};
          padding: 12px 5px; font-size: 10px; cursor: pointer; text-transform: uppercase;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%); transition: 0.2s; font-family: inherit;
        }
        .cyber-btn:hover { background: ${CYBER.primary}; color: #000; box-shadow: 0 0 15px ${CYBER.primary}66; }
        .btn-danger { border-color: ${CYBER.danger}; color: ${CYBER.danger}; }
        .btn-danger:hover { background: ${CYBER.danger}; color: #000; }

        .log-box { 
          background: rgba(0,0,0,0.4); border: 1px solid ${CYBER.border}; 
          height: 250px; overflow-y: auto; padding: 12px; font-size: 10px; line-height: 1.5;
        }
        .emergency-mode { filter: hue-rotate(-160deg) saturate(1.2); }

        /* Модальное окно */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .cyber-input { background: #000; border: 1px solid ${CYBER.primary}; color: ${CYBER.primary}; width: 100%; padding: 12px; margin: 15px 0; font-family: inherit; }
      `}</style>

      {/* --- MODAL --- */}
      {modal.active && (
        <div className="modal-overlay">
          <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
            <div className="stat-label">📡 BROADCAST_SIGNAL</div>
            <textarea className="cyber-input" rows="3" value={modal.value} onChange={e => setModal({...modal, value: e.target.value})} placeholder="SIGNAL_DATA..." />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="cyber-btn" style={{ flex: 1 }} onClick={() => setModal({ active: false, value: '' })}>SEND</button>
              <button className="cyber-btn btn-danger" style={{ flex: 1 }} onClick={() => setModal({ active: false, value: '' })}>ABORT</button>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="header">
        <div>
          <h1 className="main-title">NEURAL_PULSE</h1>
          <div style={{ fontSize: '9px', opacity: 0.5 }}>// ACCESS_LEVEL: ROOT // STATUS: OPERATIONAL</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '24px', color: CYBER.ton, fontWeight: '900' }}>{stats.balance.toLocaleString()} $NP</div>
          <div className="stat-label" style={{ color: CYBER.subtext }}>NETWORK_RESERVE</div>
        </div>
      </div>

      {/* --- TELEMETRY --- */}
      <div className="stat-grid">
        <div className="card">
          <div className="stat-label">Agents</div>
          <div className="stat-value">{stats.users}<span style={{fontSize: '10px', opacity: 0.4, marginLeft: '4px'}}>U</span></div>
          <MiniChart data={history.map(h => h.user_count)} color={CYBER.primary} />
        </div>
        <div className="card">
          <div className="stat-label" style={{ color: CYBER.ton }}>Nodes</div>
          <div className="stat-value">{stats.wallets}<span style={{fontSize: '10px', opacity: 0.4, marginLeft: '4px'}}>W</span></div>
          <MiniChart data={history.map(h => h.active_wallets)} color={CYBER.ton} />
        </div>
        <div className="card">
          <div className="stat-label" style={{ color: CYBER.success }}>CPU_Load</div>
          <div className="stat-value">{stats.load}%</div>
          <MiniChart data={history.map(h => h.server_load)} color={CYBER.success} />
        </div>
        <div className="card">
          <div className="stat-label" style={{ color: CYBER.danger }}>Latency</div>
          <div className="stat-value">{stats.lat}<span style={{fontSize: '10px', opacity: 0.4, marginLeft: '4px'}}>MS</span></div>
          <MiniChart data={history.map(h => h.db_latency)} color={CYBER.danger} />
        </div>
      </div>

      {/* --- COMMAND & LOGS --- */}
      <div className="control-section">
        <div className="card">
          <div className="stat-label" style={{ marginBottom: '15px' }}>System_Operations_Matrix</div>
          <div className="btn-matrix">
            <button className="cyber-btn" onClick={() => setModal({ active: true, value: '' })}>📢<span>Broadcast</span></button>
            <button className="cyber-btn" onClick={() => playSound(800)}>🧹<span>Purge_Cache</span></button>
            <button className="cyber-btn" onClick={() => playSound(400)}>💾<span>Cloud_Sync</span></button>
            <button className="cyber-btn btn-danger" onClick={() => { setIsEmergency(!isEmergency); playSound(200, 'sawtooth'); }}>
              ⚠️<span>{isEmergency ? 'Resume' : 'Kill_Switch'}</span>
            </button>
          </div>
          <div style={{ marginTop: '25px' }}>
            <div className="stat-label" style={{ opacity: 0.4 }}>Oscilloscope_Stream</div>
            <NeuralWave active={isEmergency} />
          </div>
        </div>

        <div className="log-box">
          <div style={{ color: CYBER.success, marginBottom: '8px', borderBottom: '1px solid #222', paddingBottom: '4px' }}>[LIVE_KERNEL_FEED]</div>
          {logs.map((l, i) => (
            <div key={i} style={{ marginBottom: '4px', opacity: 0.8 }}>{l}</div>
          ))}
          <div ref={logRef} />
        </div>
      </div>

      <footer style={{ marginTop: '30px', textAlign: 'center', fontSize: '8px', opacity: 0.2, letterSpacing: '4px' }}>
        PROPERTY_OF_NEURAL_PULSE_NETWORK // 2026
      </footer>
    </div>
  );
};

export default Dashboard;
