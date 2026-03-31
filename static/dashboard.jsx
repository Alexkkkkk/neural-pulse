import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 NEURAL_PULSE EXACT COLOR PALETTE (From Screenshot) ---
const CYBER = {
  bg: '#020406',
  card: '#0a0e14',
  primary: '#00f2fe',    // Neon Cyan
  ton: '#0088CC',
  success: '#39ff14',   // Neon Green
  danger: '#ff003c',    // Neon Red
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: '#1a1f26',
};

// --- 🔉 AUDIO ENGINE ---
const playSound = (freq, type = 'sine', dur = 0.1) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (e) {}
};

// --- 📉 AREA CHART COMPONENT (For Kernel Load) ---
const AreaChart = memo(({ data, color, height = 50 }) => {
  const chartData = (data && data.length > 1) ? data : [0, 0];
  const max = Math.max(...chartData) || 1;
  const points = chartData.map((val, i) => ({
    x: (i / (chartData.length - 1)) * 100,
    y: height - (val / max) * height,
  }));
  const areaPathData = `M 0,${height} ${points.map(p => `L ${p.x},${p.y}`).join(' ')} L 100,${height} Z`;
  const linePathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  
  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible' }}>
      <path d={areaPathData} fill={`${color}22`} />
      <path d={linePathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
});

// --- 📈 LINE CHART COMPONENT (For Latency with Peak) ---
const LineChart = memo(({ data, color, height = 50 }) => {
  const chartData = (data && data.length > 1) ? data : [0, 0];
  const max = Math.max(...chartData) || 1;
  const points = chartData.map((val, i) => ({
    x: (i / (chartData.length - 1)) * 100,
    y: height - (val / max) * height,
  }));
  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  
  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
});

const Dashboard = (props) => {
  const { data } = props;
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const logRef = useRef(null);

  // --- EXACT STATE FROM SCREENSHOT ---
  const [logs, setLogs] = useState(['> SYSTEM_READY', '> TITAN_NODE_01_OPERATIONAL']);
  const [stats, setStats] = useState({
    agents: '1U',
    tonPool: 65.5,
    kernel: 10.7,
    latency: 101,
    liquidity: 1000
  });

  // Имитация истории для графиков (соответствует пику на скриншоте)
  const [kernelHistory] = useState([8, 12, 11, 15, 18, 16, 14, 10.7]);
  const [latHistory] = useState([95, 96, 94, 95, 95, 96, 95, 190]); // Резкий пик в конце

  // --- 🛰️ REAL-TIME STREAM (SSE) ---
  useEffect(() => {
    // В данном случае, так как мы копируем дизайн, данные статичны.
    // Если есть реальный API, раскомментируй этот блок.
    /*
    const eventSource = new EventSource('/api/admin/stream');
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.event_type === 'SYSTEM') {
          setStats(prev => ({ ...prev, liquidity: update.total_liquidity }));
        }
      } catch (err) {}
    };
    */
    setTimeout(() => { setIsLoaded(true); playSound(600); }, 500);
    // return () => eventSource.close();
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  if (!isLoaded) return <div style={{ background: '#000', height: '100vh' }} />;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      {/* Подключаем шрифт Roboto Mono для имитации терминала */}
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />
      
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'Roboto Mono', monospace; color: ${CYBER.text}; transition: filter 0.5s; }
        .header { margin-bottom: 25px; border-left: 2px solid ${CYBER.primary}; padding-left: 15px; position: relative; }
        .title { color: ${CYBER.primary}; font-size: 28px; letter-spacing: 2px; margin: 0; font-weight: 700; text-transform: uppercase; }
        .subtitle { font-size: 9px; opacity: 0.5; letter-spacing: 1px; margin-top: 5px; }
        
        .liquidity-block { margin: 25px 0; }
        .liq-value { font-size: 32px; font-weight: bold; color: ${CYBER.primary}; }
        .liq-label { font-size: 10px; color: ${CYBER.primary}; opacity: 0.8; letter-spacing: 1px; text-transform: uppercase; margin-top: 5px; }

        .tabs { display: flex; gap: 30px; margin-bottom: 25px; border-bottom: 1px solid #1a1f26; }
        .tab { background: none; border: none; color: #333; padding: 10px 0; font-size: 12px; cursor: pointer; text-transform: uppercase; font-weight: bold; transition: 0.3s; }
        .tab.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 18px; border-radius: 2px; position: relative; }
        .card-label { font-size: 9px; color: ${CYBER.primary}; text-transform: uppercase; margin-bottom: 8px; opacity: 0.7; letter-spacing: 1px; }
        .card-value { font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 5px; color: #fff; }
        
        .ops-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
        .op-btn { background: #fff; color: #000; border: none; padding: 12px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 2px; }
        .op-btn:active { opacity: 0.7; }
        
        .emergency { filter: hue-rotate(-160deg) saturate(1.5); }
        .broadcast-input { width: 100%; background: #000; border: 1px solid ${CYBER.border}; color: ${CYBER.primary}; padding: 12px; margin-top: 10px; font-family: inherit; font-size: 10px; outline: none; }
        
        .wave-svg { width: 100%; height: 30px; margin-top: 15px; opacity: 0.5; }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${CYBER.primary}44; }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <h1 className="title">NEURAL_PULSE</h1>
        <div className="subtitle">// ACCESS_ROOT // NODE: NL4 // OS: 9.5</div>
      </div>

      {/* LIQUIDITY SECTION */}
      <div className="liquidity-block">
        <div className="liq-value">{stats.liquidity.toLocaleString()} $NP</div>
        <div className="liq-label">TOTAL_LIQUIDITY</div>
      </div>

      {/* NAVIGATION */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ Overview ]</button>
        <button className={`tab ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ Airdrop_Manager ]</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid">
            {/* AGENTS */}
            <div className="card">
              <div className="card-label">Agents</div>
              <div className="card-value">{stats.agents}</div>
              <div style={{height: '2px', background: CYBER.primary, marginTop: '20px', width: '60%'}}></div>
            </div>
            
            {/* TON_POOL */}
            <div className="card">
              <div className="card-label">Ton_Pool</div>
              <div className="card-value">
                {stats.tonPool.toFixed(1)} 
                <span style={{color: CYBER.ton, fontSize: '20px', marginLeft: '5px'}}>💎</span>
              </div>
              <div style={{height: '2px', background: CYBER.ton, marginTop: '20px', width: '60%'}}></div>
            </div>
            
            {/* KERNEL_LOAD */}
            <div className="card">
              <div className="card-label" style={{color: CYBER.success}}>Kernel_Load</div>
              <div className="card-value">{stats.kernel}%</div>
              <AreaChart data={kernelHistory} color={CYBER.success} />
            </div>
            
            {/* LATENCY */}
            <div className="card">
              <div className="card-label" style={{color: CYBER.danger}}>Latency</div>
              <div className="card-value">{stats.latency}ms</div>
              <LineChart data={latHistory} color={CYBER.danger} />
            </div>
          </div>

          {/* CORE OPERATIONS */}
          <div className="card">
            <div className="card-label">Core_Operations</div>
            <div className="ops-grid">
              <button className="op-btn" onClick={() => playSound(800)}>📢 Broadcast</button>
              <button className="op-btn" onClick={() => playSound(400)}>🧹 Purge</button>
              <button className="op-btn" onClick={() => playSound(600)}>💾 Sync</button>
              <button className="op-btn" onClick={() => { setIsEmergency(!isEmergency); playSound(200); }}>⚠️ Kill_Switch</button>
            </div>
            
            <input className="broadcast-input" placeholder="READY FOR INJECTION..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />

            {/* Анимированная волна под инпутом */}
            <svg className="wave-svg" viewBox="0 0 400 40">
                <path d="M0 20 Q 50 10, 100 20 T 200 20 T 300 20 T 400 20" fill="none" stroke={isEmergency ? CYBER.danger : CYBER.primary} strokeWidth="1">
                    <animate attributeName="d" dur="3s" repeatCount="indefinite" values="M0 20 Q 50 10, 100 20 T 200 20 T 300 20 T 400 20; M0 20 Q 50 30, 100 20 T 200 20 T 300 20 T 400 20; M0 20 Q 50 10, 100 20 T 200 20 T 300 20 T 400 20" />
                </path>
            </svg>
          </div>
        </>
      )}

      {activeTab === 'airdrop' && (
        <div className="card">
          <div className="card-label">Database_Module</div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: CYBER.subtext }}>[ AIRDROP_INDEXING_IN_PROGRESS ]</div>
        </div>
      )}

      {/* LIVE FEED (GLOBAL FOOTER) */}
      <footer style={{ marginTop: '25px', borderTop: '1px solid #1a1f26', paddingTop: '15px' }}>
        <div className="card-label">[ Live_Feed ]</div>
        <div ref={logRef} style={{ height: '70px', overflowY: 'auto', fontSize: '10px', marginTop: '10px', opacity: 0.5, lineHeight: '1.5' }}>
          {logs.map((l, i) => <div key={i} style={{marginBottom: '2px'}}>{l}</div>)}
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
