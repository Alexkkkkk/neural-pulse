import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

// --- 🌐 КИБЕР-СИСТЕМА ЦВЕТОВ (NEURAL PULSE OS) ---
const CYBER = {
  bg: '#05070a',
  card: '#0d1117',
  primary: '#00f2fe',
  secondary: '#7000ff',
  success: '#39ff14',
  warning: '#fbc02d',
  danger: '#ff3131',
  ton: '#0088CC',
  text: '#e6edf3',
  subtext: '#8b949e',
  border: '#30363d',
  overlay: 'rgba(5, 7, 10, 0.95)'
};

// --- 🔊 АУДИО-ДВИЖОК (Haptic & Feedback) ---
const playPulseSound = (type = 'log') => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    const freq = type === 'error' ? 150 : type === 'auth' ? 1200 : type === 'cmd' ? 600 : 880;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) { }
};

// --- 📈 МИНИ-ГРАФИКИ (Precision Engine) ---
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
    <svg width="100%" height={height} style={{ marginTop: '15px', overflow: 'visible', display: 'block' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeOpacity="1" />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.1" />
    </svg>
  );
});

const Dashboard = (props) => {
  // --- СОСТОЯНИЯ СИСТЕМЫ ---
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState(['> SYSTEM_READY', '> ENCRYPTION_ACTIVE', '> TITAN_CORE_LINKED']);
  const [scanPos, setScanPos] = useState(0);
  const [history, setHistory] = useState(props.data?.history || []);
  const [actionLoading, setActionLoading] = useState(null);
  
  const [modal, setModal] = useState({ active: false, value: '' });
  const [isMaintenance, setIsMaintenance] = useState(false);
  
  const logEndRef = useRef(null);
  const [stats, setStats] = useState({
    totalUsers: props.data?.totalUsers || 0,
    walletsLinked: props.data?.active_wallets || 0, 
    total_balance: props.data?.total_balance || 0,
    cpu: 0, mem: 0, latency: 0
  });

  const addLog = useCallback((msg, type = 'log') => {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [...prev.slice(-15), `[${time}] ${msg}`]);
    playPulseSound(type);
  }, []);

  // --- 🛰️ API EXECUTION ENGINE ---
  const executeAction = async (cmd, payload = {}) => {
    setActionLoading(cmd);
    addLog(`> INITIATING: ${cmd.toUpperCase()}...`, 'cmd');
    
    try {
      const response = await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: cmd, ...payload })
      });
      
      if (response.ok) {
        addLog(`> SUCCESS: ${cmd.toUpperCase()} EXECUTED`, 'success');
        if (cmd === 'maintenance') setIsMaintenance(!isMaintenance);
        setModal({ active: false, value: '' });
      } else throw new Error();
    } catch (e) {
      addLog(`> ERROR: ${cmd.toUpperCase()} FAILED`, 'error');
    }
    setActionLoading(null);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    // Симуляция загрузки ядра
    const loader = setInterval(() => {
      setLoadingProgress(p => {
        if (p >= 100) {
          clearInterval(loader);
          setTimeout(() => setIsReady(true), 300);
          return 100;
        }
        return p + 25;
      });
    }, 50);

    // Подключение к потоку телеметрии
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const pulse = JSON.parse(e.data);
        setStats(prev => ({
          ...prev,
          cpu: pulse.server_load ?? prev.cpu,
          mem: pulse.mem_usage ?? prev.mem,
          latency: pulse.db_latency ?? prev.latency,
          totalUsers: pulse.user_count ?? prev.totalUsers,
          walletsLinked: pulse.active_wallets ?? prev.walletsLinked,
          total_balance: pulse.total_balance ?? prev.total_balance
        }));
        if (pulse.time) setHistory(prev => [...prev.slice(-30), pulse]);
        if (pulse.recent_event) addLog(`> ${pulse.recent_event}`, pulse.event_type === 'AUTH' ? 'auth' : 'log');
      } catch (err) {}
    };
    
    const anim = setInterval(() => setScanPos(p => (p + 0.5) % 100), 50);
    return () => { clearInterval(loader); clearInterval(anim); eventSource.close(); };
  }, [addLog]);

  const StatCard = ({ label, desc, value, unit, color, historyKey }) => {
    const chartData = history.map(h => Number(h[historyKey]) || 0);
    return (
      <div className="cyber-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color, fontSize: '11px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ color: CYBER.subtext, fontSize: '10px', marginTop: '2px' }}>{desc}</div>
          </div>
          <div style={{ color: '#fff', fontSize: '22px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
            <span style={{ fontSize: '12px', color, marginLeft: '4px' }}>{unit}</span>
          </div>
        </div>
        <MiniChart data={chartData} color={color} />
      </div>
    );
  };

  if (!isReady) return (
    <div style={{ background: CYBER.bg, height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
       <div style={{ border: `1px solid ${CYBER.primary}44`, padding: '40px', background: CYBER.card, textAlign: 'center' }}>
          <div style={{ color: CYBER.primary, fontSize: '10px', letterSpacing: '8px', marginBottom: '10px' }}>BOOTING_PULSE_OS_v5.2</div>
          <div style={{ color: '#fff', fontSize: '48px', fontWeight: 'bold' }}>{loadingProgress}%</div>
       </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace', padding: '15px' }}>
      <style>{`
        .cyber-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .cyber-card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 22px; border-radius: 4px; position: relative; transition: 0.3s; }
        .cyber-card:hover { border-color: ${CYBER.primary}; transform: translateY(-2px); }
        
        .cmd-btn { 
          background: transparent; border: 1px solid ${CYBER.primary}; color: ${CYBER.primary}; 
          padding: 12px; cursor: pointer; font-family: monospace; font-size: 11px; transition: 0.3s;
          text-transform: uppercase; font-weight: bold;
        }
        .cmd-btn:hover:not(:disabled) { background: ${CYBER.primary}22; box-shadow: 0 0 15px ${CYBER.primary}44; }
        .cmd-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .emergency { border-color: ${CYBER.danger}; color: ${CYBER.danger}; }
        .emergency:hover:not(:disabled) { background: ${CYBER.danger}22; box-shadow: 0 0 15px ${CYBER.danger}44; }

        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: ${CYBER.overlay};
          display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(5px);
        }
        .cyber-input {
          background: #000; border: 1px solid ${CYBER.primary}; color: ${CYBER.primary};
          padding: 15px; width: 100%; font-family: monospace; outline: none; margin: 20px 0; resize: none;
        }
      `}</style>

      {/* --- MODAL BROADCAST TERMINAL --- */}
      {modal.active && (
        <div className="modal-overlay" onClick={() => setModal({ active: false, value: '' })}>
          <div className="cyber-card" style={{ width: '450px', borderTop: `4px solid ${CYBER.primary}` }} onClick={e => e.stopPropagation()}>
            <div style={{ color: CYBER.primary, fontSize: '12px', fontWeight: 'bold' }}>📡 BROADCAST_TERMINAL</div>
            <div style={{ color: CYBER.subtext, fontSize: '10px' }}>SEND ENCRYPTED PAYLOAD TO ALL AGENTS</div>
            <textarea 
              className="cyber-input" 
              rows="5"
              value={modal.value}
              autoFocus
              onChange={(e) => setModal({...modal, value: e.target.value})}
              placeholder="ENTER_SYSTEM_MESSAGE..."
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="cmd-btn" style={{ flex: 2 }} onClick={() => executeAction('broadcast', { message: modal.value })} disabled={!modal.value || actionLoading}>
                {actionLoading ? 'ENCRYPTING...' : 'EXECUTE_BROADCAST'}
              </button>
              <button className="cmd-btn" style={{ flex: 1, borderColor: '#444', color: '#444' }} onClick={() => setModal({ active: false, value: '' })}>ABORT</button>
            </div>
          </div>
        </div>
      )}

      {/* --- HUD HEADER --- */}
      <div style={{ 
        background: CYBER.card, 
        padding: '20px', 
        borderLeft: `4px solid ${isMaintenance ? CYBER.danger : CYBER.primary}`, 
        marginBottom: '20px', 
        position: 'relative', 
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        <div style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '2px', height: '100%', background: isMaintenance ? CYBER.danger : CYBER.primary, opacity: 0.2 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h2 style={{ color: isMaintenance ? CYBER.danger : CYBER.primary, margin: 0, fontSize: '24px', letterSpacing: '2px' }}>NEURAL_PULSE_v5.2</h2>
            <div style={{ fontSize: '10px', color: CYBER.subtext }}>
              STATUS: <span style={{ color: isMaintenance ? CYBER.danger : CYBER.success }}>{isMaintenance ? 'MAINTENANCE_ACTIVE' : 'CORE_STABLE'}</span> // SYSTEM_2026
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: CYBER.ton, fontSize: '24px', fontWeight: 'bold', textShadow: `0 0 10px ${CYBER.ton}44` }}>{stats.total_balance.toLocaleString()} $NP</div>
            <div style={{ fontSize: '9px', color: CYBER.subtext, letterSpacing: '1px' }}>NETWORK_EMISSION_RESERVE</div>
          </div>
        </div>
      </div>

      {/* --- TELEMETRY CARDS --- */}
      <div className="cyber-grid">
        <StatCard label="Agents" desc="TOTAL_CONNECTED" value={stats.totalUsers} unit="U" color={CYBER.primary} historyKey="user_count" />
        <StatCard label="Nodes" desc="ACTIVE_WALLETS" value={stats.walletsLinked} unit="W" color={CYBER.ton} historyKey="active_wallets" />
        <StatCard label="Buffer" desc="RAM_ALLOCATION" value={stats.mem} unit="MB" color={CYBER.warning} historyKey="mem_usage" />
        <StatCard label="Pulse" desc="CPU_CAPACITY" value={stats.cpu} unit="%" color={CYBER.secondary} historyKey="server_load" />
        <StatCard label="Latency" desc="DB_RESPONSE" value={stats.latency} unit="MS" color={CYBER.danger} historyKey="db_latency" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        
        {/* --- COMMAND CENTER & SIGNAL --- */}
        <div className="cyber-card">
          <div style={{ color: CYBER.primary, fontSize: '12px', borderBottom: `1px solid ${CYBER.border}`, paddingBottom: '10px', marginBottom: '20px', fontWeight: 'bold' }}>
            OPERATIONS_CONTROL_INTERFACE
          </div>
          <div style={{ display: grid, gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <button className="cmd-btn" onClick={() => setModal({ active: true, value: '' })}>📢 BROADCAST</button>
            <button className="cmd-btn" onClick={() => executeAction('clear_cache')}>🧹 PURGE_CACHE</button>
            <button className="cmd-btn" onClick={() => executeAction('backup')}>💾 SYS_BACKUP</button>
            <button className={`cmd-btn ${isMaintenance ? '' : 'emergency'}`} onClick={() => executeAction('maintenance')}>
              {isMaintenance ? '▶️ RESUME' : '⚠️ MAINTENANCE'}
            </button>
          </div>

          <div style={{ marginTop: '30px', background: '#000', padding: '15px', borderRadius: '4px', border: `1px solid ${CYBER.border}` }}>
             <div style={{ color: CYBER.subtext, fontSize: '9px', marginBottom: '10px', opacity: 0.5 }}>OSCILLOSCOPE_STREAM_CORE</div>
             <div style={{ display: 'flex', alignItems: 'flex-end', height: '60px', gap: '3px' }}>
                {[...Array(40)].map((_, i) => (
                  <div key={i} style={{ 
                    flex: 1, 
                    background: isMaintenance ? CYBER.danger : CYBER.primary, 
                    height: `${15 + Math.random() * 85}%`,
                    opacity: 0.4 + (Math.random() * 0.6),
                    transition: 'height 0.2s ease'
                  }} />
                ))}
             </div>
          </div>
        </div>

        {/* --- LIVE TELEMETRY LOGS --- */}
        <div style={{ background: '#000', border: `1px solid ${CYBER.border}`, padding: '15px', borderRadius: '4px', position: 'relative' }}>
          <div style={{ color: CYBER.success, fontSize: '11px', fontWeight: 'bold', marginBottom: '15px', display: 'flex', justifyContent: 'space-between' }}>
            <span>LIVE_KERNEL_FEED</span>
            <span style={{ fontSize: '8px', opacity: 0.4 }}>SECURE_CONNECTION_STABLE</span>
          </div>
          <div style={{ fontSize: '11px', lineHeight: '1.8', height: '280px', overflowY: 'auto', scrollBehavior: 'smooth' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ 
                color: log.includes('ERROR') ? CYBER.danger : log.includes('SUCCESS') ? CYBER.success : CYBER.subtext,
                marginBottom: '2px'
              }}>
                {log}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

      </div>
      
      {/* --- FOOTER --- */}
      <div style={{ textAlign: 'center', marginTop: '20px', color: '#1a1f26', fontSize: '9px', letterSpacing: '6px' }}>
        PROPERTY_OF_NEURAL_PULSE_NETWORK // ACCESS_LEVEL_ROOT
      </div>
    </div>
  );
};

export default Dashboard;
