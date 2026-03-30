import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

// --- 🌐 NEURAL PULSE OS COLOR SYSTEM ---
const CYBER = {
  bg: '#0b0e14',
  card: '#161b22',
  primary: '#00f2fe',
  secondary: '#7000ff',
  success: '#39ff14',
  warning: '#fbc02d',
  danger: '#ff3131',
  ton: '#0088CC',
  text: '#ffffff',
  border: '#30363d'
};

// --- 🔊 NEURAL AUDIO ENGINE ---
const playPulseSound = (type = 'log') => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    // Разная тональность для разных событий
    const freq = type === 'error' ? 150 : type === 'auth' ? 1200 : 880;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) { }
};

const MiniChart = memo(({ data, color, height = 30 }) => {
  if (!data || data.length < 2) return <div style={{ height: height + 10 }} />;
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
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible', display: 'block' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.8" />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.1" />
    </svg>
  );
});

const Dashboard = (props) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState(['> INITIALIZING_BOOT_SEQUENCE...', '> KERNEL_LOADED', '> SYNCING_WITH_TITAN_CORE...']);
  const [scanPos, setScanPos] = useState(0);
  const [history, setHistory] = useState(props.data?.history || []);
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

  // Авто-скролл для логов терминала
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    const loader = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(loader);
          setTimeout(() => {
            setIsReady(true);
            addLog('> CORE_SYSTEM_READY', 'log');
          }, 400);
          return 100;
        }
        return prev + 10;
      });
    }, 50);

    const eventSource = new EventSource('/api/admin/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const pulse = JSON.parse(event.data);
        setStats(prev => ({
          ...prev,
          cpu: pulse.server_load ?? prev.cpu,
          mem: pulse.mem_usage ?? prev.mem,
          latency: pulse.db_latency ?? prev.latency,
          totalUsers: pulse.user_count ?? prev.totalUsers,
          walletsLinked: pulse.active_wallets ?? prev.walletsLinked,
          total_balance: pulse.total_balance ?? prev.total_balance
        }));

        if (pulse.time) {
          setHistory(prev => [...prev.slice(-29), pulse]);
        }

        // Обработка живых событий из main.js
        if (pulse.recent_event) {
          const isAuth = pulse.event_type === 'AUTH';
          addLog(`> ${pulse.recent_event}`, isAuth ? 'auth' : 'log');
        }
      } catch (e) { console.error("Pulse error:", e); }
    };

    eventSource.onerror = () => {
      addLog('> ERROR: TELEMETRY_LINK_LOST', 'error');
    };

    const animInterval = setInterval(() => setScanPos(p => (p + 0.5) % 100), 50);

    return () => {
      clearInterval(loader);
      clearInterval(animInterval);
      eventSource.close();
    };
  }, [addLog]);

  const StatCard = ({ label, value, unit, color, historyKey }) => {
    const chartData = history.map(h => Number(h[historyKey]) || 0);
    // Рассчет прогресса для полосок
    let progressPercent = unit === '%' ? value : unit === 'MB' ? (value / 2048) * 100 : (value / 1000) * 100;

    return (
      <div style={{ 
        flex: '1 1 200px', margin: '10px', padding: '20px', 
        background: CYPER.card, border: `1px solid ${color}33`, borderRadius: '4px',
        position: 'relative', overflow: 'hidden', boxShadow: `inset 0 0 15px ${color}05`
      }}>
        <div style={{ color: '#8b949e', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px', fontWeight: 'bold' }}>{label}</div>
        <div style={{ color: '#fff', fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', fontFamily: 'monospace' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
          <span style={{ fontSize: '14px', color: color, marginLeft: '6px' }}>{unit}</span>
        </div>
        <MiniChart data={chartData} color={color} />
        <div style={{ width: '100%', height: '2px', background: '#000', marginTop: '18px' }}>
          <div style={{ 
            width: `${Math.min(progressPercent, 100)}%`, 
            height: '100%', background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s ease' 
          }} />
        </div>
      </div>
    );
  };

  if (!isReady) {
    return (
      <div style={{ background: CYBER.bg, color: CYBER.primary, height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center', border: `1px solid ${CYBER.primary}33`, padding: '40px', background: CYBER.card }}>
          <div style={{ fontSize: '10px', letterSpacing: '5px', marginBottom: '20px' }}>BOOT_NEURAL_OS...</div>
          <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{loadingProgress}%</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace', padding: '20px' }}>
      <style>{`
        #adminjs, .adminjs_Box, [data-testid="sidebar"], [data-testid="resource-header"], .adminjs_Table { 
            background: ${CYBER.bg} !important; 
        }
        [data-testid="sidebar"] { border-right: 1px solid ${CYBER.border} !important; }
        .adminjs_Table td, .adminjs_Table th { border-bottom: 1px solid ${CYBER.border} !important; color: #8b949e !important; }
        .adminjs_Button, button { border-radius: 0 !important; text-transform: uppercase !important; font-family: monospace !important; }
        
        .glitch-title:hover {
          animation: glitch 0.3s cubic-bezier(.25,.46,.45,.94) both infinite;
          color: ${CYBER.secondary} !important;
        }
        @keyframes glitch {
          0% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); text-shadow: 2px 0 ${CYBER.danger}; }
          40% { transform: translate(-2px, -2px); text-shadow: -2px 0 ${CYBER.primary}; }
          100% { transform: translate(0); }
        }
        @keyframes cyber-pulse {
          0%, 100% { height: 30%; opacity: 0.4; }
          50% { height: 80%; opacity: 1; }
        }
      `}</style>

      {/* --- HUD HEADER --- */}
      <div style={{ background: CYBER.card, padding: '25px', borderRadius: '4px', border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '1px', height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.3 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ padding: '2px 8px', background: CYBER.primary, color: '#000', fontWeight: 'bold', fontSize: '10px' }}>NEURAL_PULSE_V4.2</span>
            <h2 className="glitch-title" style={{ color: CYBER.primary, margin: '10px 0 0 0', fontSize: '24px' }}>TITAN_MONITOR</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: CYBER.ton, fontWeight: 'bold', fontSize: '20px' }}>{stats.total_balance.toLocaleString()} $NP</div>
            <div style={{ color: '#444', fontSize: '9px' }}>TOTAL_SUPPLY</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0 -10px' }}>
        <StatCard label="AGENTS" value={stats.totalUsers} unit="U" color={CYBER.primary} historyKey="user_count" />
        <StatCard label="WALLETS" value={stats.walletsLinked} unit="W" color={CYBER.ton} historyKey="active_wallets" />
        <StatCard label="MEMORY" value={stats.mem} unit="MB" color={CYBER.warning} historyKey="mem_usage" />
        <StatCard label="CPU_LOAD" value={stats.cpu} unit="%" color={CYBER.secondary} historyKey="server_load" />
        <StatCard label="LATENCY" value={stats.latency} unit="MS" color={CYBER.danger} historyKey="db_latency" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '20px', gap: '20px' }}>
        {/* Визуализатор активности (Эквалайзер) */}
        <div style={{ flex: '2 1 400px', background: CYBER.card, height: '220px', border: `1px solid ${CYBER.border}`, borderRadius: '4px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '6px', paddingBottom: '20px' }}>
          {[...Array(30)].map((_, i) => (
            <div key={i} style={{ width: '6px', background: `linear-gradient(to top, ${CYBER.primary}, ${CYBER.secondary})`, height: `${20 + (Math.random() * 50)}%`, animation: `cyber-pulse ${0.8 + (Math.random() * 1)}s infinite ${i * 0.05}s ease-in-out` }} />
          ))}
        </div>

        {/* Логи терминала с авто-скроллом */}
        <div style={{ flex: '1 1 300px', background: '#05070a', height: '220px', border: `1px solid ${CYBER.border}`, padding: '15px', overflowY: 'auto' }}>
          <div style={{ color: CYBER.success, fontSize: '10px', marginBottom: '8px', borderBottom: `1px solid ${CYBER.success}44`, paddingBottom: '4px' }}>KERNEL_LOGS</div>
          <div style={{ fontSize: '10px', lineHeight: '1.6', fontFamily: 'monospace' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ color: log.includes('ERROR') ? CYBER.danger : log.includes('NEW_AGENT') ? CYBER.primary : log.includes('READY') ? CYBER.success : '#4e555d' }}>{log}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
