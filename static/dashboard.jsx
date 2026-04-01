import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 ЦВЕТОВАЯ ПАЛИТРА NEURAL_PULSE V4.0 ---
const CYBER = {
  bg: '#000000',
  card: 'rgba(7, 10, 15, 0.8)',
  primary: '#00f2fe',
  ton: '#0088CC',
  success: '#39ff14',
  danger: '#ff003c',
  warning: '#ffea00',
  secondary: '#7000ff',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: 'rgba(0, 242, 254, 0.1)',
};

// --- 📈 НЕОНОВЫЙ ГРАФИК (Sparkline) ---
const SparkGraph = memo(({ data, color, height = 55 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * 40 - 5,
  }));

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
            style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <circle cx="100" cy={points[points.length-1].y} r="3" fill={color} />
    </svg>
  );
});

// --- 📊 ИНДИКАТОРЫ РЕСУРСОВ (Top Bar) ---
const TelemetryBar = ({ label, value, color }) => (
  <div style={{ flex: 1, minWidth: '120px' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
      <span style={{ color: '#4a5568', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
      <span style={{ color, fontSize: '11px', fontWeight: 'bold', textShadow: `0 0 10px ${color}` }}>{parseFloat(value).toFixed(1)}%</span>
    </div>
    <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ 
        width: `${Math.min(value, 100)}%`, 
        height: '100%', 
        background: color, 
        boxShadow: `0 0 10px ${color}`,
        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
      }} />
    </div>
  </div>
);

// --- 🗳️ КАРТОЧКА ДАННЫХ ---
const DataCard = ({ label, value, unit, data, color, isTon }) => (
  <div className="card">
    <div className="card-scanline" />
    <div className="label" style={{ color }}>{label}</div>
    <div className="val-main">
      {value}
      <span className="val-unit">
        {isTon ? <><span style={{ fontSize: '14px', marginLeft: '5px' }}>💎</span> {unit}</> : unit}
      </span>
    </div>
    <SparkGraph data={data} color={color} />
  </div>
);

const Dashboard = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const logRef = useRef(null);

  const [stats, setStats] = useState({ cpu: 0, ram: 0, storage: 22.4, online: 0, liquidity: 0, latency: 0, ton: 0 });
  const [history, setHistory] = useState({
    cpu: Array(10).fill(0), online: Array(10).fill(0), wallets: Array(10).fill(0), liq: Array(10).fill(0), lat: Array(10).fill(0)
  });

  const [logs, setLogs] = useState(['> INITIALIZING_V4_CORE...', '> LINK_ESTABLISHED']);

  const runCommand = async (cmd) => {
    setLogs(p => [...p, `> EXEC: ${cmd.toUpperCase()}...`]);
    try {
      const res = await fetch(`/api/admin/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      setLogs(p => [...p, `> STATUS: ${data.status || 'OK'}`]);
    } catch (e) {
      setLogs(p => [...p, `> ERROR_LINK_FAILURE`]);
    }
  };

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event_type === 'SYSTEM') {
        const nCpu = parseFloat(data.core_load || 0);
        setStats(p => ({
          ...p, cpu: nCpu, ram: data.sync_memory || 0, latency: data.network_latency || 0,
          online: data.active_agents || 0, ton: data.ton_reserve || 0, liquidity: data.total_liquidity || 0
        }));
        setHistory(p => ({
          cpu: [...p.cpu.slice(1), nCpu],
          online: [...p.online.slice(1), data.active_agents],
          wallets: [...p.wallets.slice(1), data.ton_reserve],
          liq: [...p.liq.slice(1), data.total_liquidity],
          lat: [...p.lat.slice(1), data.network_latency]
        }));
      }
    };
    setTimeout(() => setIsLoaded(true), 800);
    return () => eventSource.close();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  if (!isLoaded) return <div className="loading">CONNECTING_TO_NEURAL_PULSE...</div>;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`
        .app-root { 
          background: #000; min-height: 100vh; padding: 20px; font-family: 'Roboto Mono', monospace; color: #fff;
          background-image: linear-gradient(rgba(0, 242, 254, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 242, 254, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .header { margin-bottom: 25px; border-left: 3px solid ${CYBER.primary}; padding-left: 15px; }
        .res-panel { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; border-radius: 12px; padding: 20px; margin-bottom: 15px; backdrop-filter: blur(10px); }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 18px; border-radius: 12px; position: relative; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .card-scanline { position: absolute; top: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(90deg, transparent, ${CYBER.primary}22, transparent); animation: scan 4s linear infinite; }
        @keyframes scan { from { top: -10%; } to { top: 110%; } }
        .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; font-weight: bold; }
        .val-main { font-size: 32px; font-weight: 700; display: flex; align-items: baseline; }
        .val-unit { font-size: 10px; color: ${CYBER.subtext}; margin-left: 6px; }
        .op-btn { 
          background: #eee; color: #000; border: none; padding: 12px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase; border-radius: 4px; transition: 0.2s;
        }
        .op-btn:hover { background: #fff; transform: translateY(-1px); }
        .emergency { filter: saturate(0) brightness(0.8) sepia(1) hue-rotate(-50deg); }
        .loading { background: #000; height: 100vh; display: flex; align-items: center; justifyContent: center; color: ${CYBER.primary}; }
      `}</style>

      <div className="header">
        <h1 style={{ fontSize: '22px', letterSpacing: '4px', color: CYBER.primary }}>NEURAL_PULSE V4.0</h1>
        <div style={{ fontSize: '9px', opacity: 0.6 }}>● SYSTEM_READY // UPLINK_TITAN_01 // SECURE_LAYER_6</div>
      </div>

      <div className="res-panel">
        <div className="label" style={{ color: CYBER.primary, marginBottom: '15px' }}>Neural_Node_Resources</div>
        <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
          <TelemetryBar label="Core_Processing" value={stats.cpu} color={CYBER.primary} />
          <TelemetryBar label="Sync_Memory" value={stats.ram} color={CYBER.secondary} />
          <TelemetryBar label="Vault_Storage" value={stats.storage} color={CYBER.warning} />
        </div>
      </div>

      <div className="grid">
        <DataCard label="Active_Agents" value={stats.online} unit="USERS" data={history.online} color={CYBER.success} />
        <DataCard label="Ton_Reserve" value={stats.ton.toFixed(1)} unit="TON" data={history.wallets} color={CYBER.ton} isTon={true} />
        <DataCard label="Network_Latency" value={stats.latency} unit="MS" data={history.lat} color={CYBER.danger} />
        <DataCard label="Pulse_Liquidity" value={stats.liquidity} unit="$NP" data={history.liq} color={CYBER.warning} />

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label" style={{ color: CYBER.primary }}>Directive_Control</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <button className="op-btn" onClick={() => runCommand('broadcast')}>Broadcast</button>
            <button className="op-btn" onClick={() => runCommand('purge')}>Purge</button>
            <button className="op-btn" onClick={() => runCommand('sync')}>Sync</button>
            <button className="op-btn" style={{ background: 'transparent', border: '1px solid #ff003c', color: '#ff003c' }} 
                    onClick={() => { setIsEmergency(!isEmergency); runCommand('kill_switch'); }}>
              {isEmergency ? 'RESTORE' : 'Kill_Switch'}
            </button>
          </div>
        </div>
      </div>

      <footer style={{ marginTop: '20px', opacity: 0.4, fontSize: '9px' }}>
        <div ref={logRef} style={{ height: '60px', overflowY: 'auto', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: `1px solid ${CYBER.border}` }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
          <div>{`> HEARTBEAT_STABLE: ${new Date().toLocaleTimeString()}`}</div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
