import React, { useState, useEffect, memo, useCallback, useRef } from 'react';

// --- 🌐 NEURAL PULSE OS COLOR SYSTEM (Оптимизированная читаемость) ---
const CYBER = {
  bg: '#05070a',
  card: '#0d1117',
  primary: '#00f2fe',
  secondary: '#7000ff',
  success: '#39ff14',
  warning: '#fbc02d',
  danger: '#ff3131',
  ton: '#0088CC',
  text: '#e6edf3',     // Яркий текст
  subtext: '#8b949e',  // Тусклый для подписей
  border: '#30363d'
};

// --- 🔊 NEURAL AUDIO ENGINE ---
const playPulseSound = (type = 'log') => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    const freq = type === 'error' ? 150 : type === 'auth' ? 1200 : 880;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) { }
};

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
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.15" />
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

  const StatCard = ({ label, desc, value, unit, color, historyKey }) => {
    const chartData = history.map(h => Number(h[historyKey]) || 0);
    let progressPercent = unit === '%' ? value : unit === 'MB' ? (value / 2048) * 100 : (value / 1000) * 100;

    return (
      <div style={{ 
        flex: '1 1 240px', margin: '10px', padding: '24px', 
        background: CYBER.card, border: `1px solid ${CYBER.border}`, borderRadius: '8px',
        position: 'relative', overflow: 'hidden', boxShadow: `0 4px 20px rgba(0,0,0,0.5)`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: color, fontSize: '11px', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ color: CYBER.subtext, fontSize: '10px', marginTop: '2px' }}>{desc}</div>
          </div>
          <div style={{ color: '#fff', fontSize: '26px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: `0 0 10px ${color}44` }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
            <span style={{ fontSize: '14px', color: color, marginLeft: '4px' }}>{unit}</span>
          </div>
        </div>
        
        <MiniChart data={chartData} color={color} />
        
        <div style={{ width: '100%', height: '2px', background: '#000', marginTop: '15px' }}>
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
        #adminjs, .adminjs_Box, [data-testid="sidebar"], [data-testid="resource-header"], .adminjs_Table, section { 
            background: ${CYBER.bg} !important; 
            border: none !important;
        }
        [data-testid="sidebar"] { border-right: 1px solid ${CYBER.border} !important; }
        .adminjs_Table td, .adminjs_Table th { border-bottom: 1px solid ${CYBER.border} !important; color: ${CYBER.subtext} !important; }
        .adminjs_Button, button { border-radius: 4px !important; text-transform: uppercase !important; font-family: monospace !important; }
        
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
      <div style={{ background: CYBER.card, padding: '25px', borderRadius: '8px', borderLeft: `4px solid ${CYBER.primary}`, position: 'relative', overflow: 'hidden', marginBottom: '20px', boxShadow: `0 10px 30px rgba(0,0,0,0.5)` }}>
        <div style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '2px', height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.2 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ padding: '2px 8px', background: CYBER.primary, color: '#000', fontWeight: 'bold', fontSize: '10px' }}>SYSTEM_ACTIVE</span>
            <h2 className="glitch-title" style={{ color: CYBER.primary, margin: '10px 0 0 0', fontSize: '26px', letterSpacing: '2px' }}>TITAN_MONITOR_V4</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: CYBER.ton, fontWeight: 'bold', fontSize: '24px', textShadow: `0 0 10px ${CYBER.ton}44` }}>{stats.total_balance.toLocaleString()} $NP</div>
            <div style={{ color: CYBER.subtext, fontSize: '9px', letterSpacing: '1px' }}>TOTAL_NETWORK_EMISSION</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0 -10px' }}>
        <StatCard label="Agents" desc="TOTAL_ACTIVE_USERS" value={stats.totalUsers} unit="U" color={CYBER.primary} historyKey="user_count" />
        <StatCard label="Wallets" desc="CONNECTED_TON_NODES" value={stats.walletsLinked} unit="W" color={CYBER.ton} historyKey="active_wallets" />
        <StatCard label="Memory" desc="RAM_ALLOCATION_MB" value={stats.mem} unit="MB" color={CYBER.warning} historyKey="mem_usage" />
        <StatCard label="CPU Load" desc="PROCESSOR_UTILIZATION" value={stats.cpu} unit="%" color={CYBER.secondary} historyKey="server_load" />
        <StatCard label="Latency" desc="DATABASE_PING_TIME" value={stats.latency} unit="MS" color={CYBER.danger} historyKey="db_latency" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '20px', gap: '20px' }}>
        <div style={{ flex: '2 1 400px', background: CYBER.card, height: '220px', border: `1px solid ${CYBER.border}`, borderRadius: '8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '6px', paddingBottom: '20px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '10px', left: '15px', color: CYBER.primary, fontSize: '10px', opacity: 0.5 }}>SIGNAL_OSCILLOSCOPE</div>
          {[...Array(40)].map((_, i) => (
            <div key={i} style={{ width: '4px', background: `linear-gradient(to top, ${CYBER.primary}, ${CYBER.secondary})`, height: `${20 + (Math.random() * 60)}%`, borderRadius: '2px', animation: `cyber-pulse ${0.8 + (Math.random() * 1.2)}s infinite ${i * 0.03}s ease-in-out` }} />
          ))}
        </div>

        <div style={{ flex: '1 1 300px', background: '#000', height: '220px', border: `1px solid ${CYBER.border}`, borderRadius: '8px', padding: '15px', overflowY: 'auto', boxShadow: `inset 0 0 20px #000` }}>
          <div style={{ color: CYBER.success, fontSize: '11px', marginBottom: '10px', borderBottom: `1px solid ${CYBER.success}33`, paddingBottom: '5px', fontWeight: 'bold' }}>LIVE_KERNEL_LOGS</div>
          <div style={{ fontSize: '11px', lineHeight: '1.8', fontFamily: 'monospace' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ color: log.includes('ERROR') ? CYBER.danger : log.includes('CORE') ? CYBER.success : CYBER.subtext }}>{log}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
