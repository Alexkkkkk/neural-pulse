import React, { useState, useEffect, memo, useRef } from 'react';

// --- 🌌 INFINITY-PULSE CORE PALETTE ---
const CYBER = {
  bg: '#020406',
  card: 'rgba(6, 9, 13, 0.95)',
  primary: '#00f2fe',    
  secondary: '#7000ff', 
  success: '#39ff14',   
  warning: '#ffea00',   
  danger: '#ff003c',    
  ton: '#0088CC',
  text: '#e2e8f0',
  subtext: '#8b949e',
  border: 'rgba(0, 242, 254, 0.25)',
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
  const chartData = (data && data.length > 1) ? data : [0, 0];
  const cleanData = chartData.map(v => (Number.isFinite(v) ? v : 0));
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
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ transition: 'all 0.5s ease' }} />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.1" />
    </svg>
  );
});

const Dashboard = (props) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const logRef = useRef(null);

  // --- РАСШИРЕННАЯ СТАТИСТИКА (с учетом общего TON) ---
  const [stats, setStats] = useState({
    load: 12.4,
    lat: 98,
    ram: 44,
    totalUsers: 1250,
    activeTappers: 52,
    linkedWallets: 842,
    totalTonPool: 4520.50, // ОБЩЕЕ КОЛИЧЕСТВО TON
    tonInflow: 0.45         // Текущий приток
  });

  const [history, setHistory] = useState({
    load: Array(20).fill(10),
    lat: Array(20).fill(100),
    tappers: Array(20).fill(50),
    tonInflow: Array(20).fill(0.5)
  });

  const [users] = useState(props.data?.usersList || [
    { id: '@alex_neo', ton: 65.5, taps: 845000, status: 'active' },
    { id: '@kander_dev', ton: 12.0, taps: 2100000, status: 'active' },
    { id: '@guest_01', ton: 0.0, taps: 15000, status: 'active' }
  ]);

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 500);
    const interval = setInterval(() => {
      setStats(prev => {
        const inflow = Math.random() * 1.5;
        const nextLoad = Math.max(5, Math.min(95, prev.load + (Math.random() * 4 - 2)));
        const nextLat = Math.max(40, Math.min(200, prev.lat + (Math.random() * 10 - 5)));
        const nextTappers = Math.max(10, Math.min(300, prev.activeTappers + Math.floor(Math.random() * 6 - 3)));
        
        // Обновляем общую сумму TON при каждом шаге
        const nextTotalTon = prev.totalTonPool + inflow;

        setHistory(h => ({
          load: [...h.load.slice(-19), nextLoad],
          lat: [...h.lat.slice(-19), nextLat],
          tappers: [...h.tappers.slice(-19), nextTappers],
          tonInflow: [...h.tonInflow.slice(-19), inflow]
        }));

        return { 
          ...prev, 
          load: nextLoad, 
          lat: nextLat, 
          activeTappers: nextTappers, 
          tonInflow: inflow,
          totalTonPool: nextTotalTon
        };
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  if (!isLoaded) return <div style={{background:'#000', height:'100vh'}} />;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 15px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; transition: filter 0.5s; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 12px; margin-bottom: 12px; }
        .label { font-size: 8px; color: ${CYBER.primary}; text-transform: uppercase; letter-spacing: 1px; }
        .value { font-size: 20px; font-weight: bold; margin-top: 4px; }
        .unit { font-size: 10px; opacity: 0.5; margin-left: 4px; }
        .nav-tabs { display: flex; gap: 15px; margin-bottom: 15px; border-bottom: 1px solid ${CYBER.border}; }
        .tab-btn { background: none; border: none; color: #444; padding: 10px 0; font-size: 10px; cursor: pointer; text-transform: uppercase; }
        .tab-btn.active { color: ${CYBER.primary}; border-bottom: 2px solid ${CYBER.primary}; }
        .emergency-btn { width: 100%; background: ${CYBER.danger}; color: #fff; border: none; padding: 12px; font-weight: bold; cursor: pointer; }
        .emergency { filter: hue-rotate(-160deg); }
      `}</style>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '22px', letterSpacing: '2px' }}>NEURAL_PULSE</h1>
          <div style={{ fontSize: '8px', opacity: 0.5 }}>OS_v9.8 // ADMIN_PANEL</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label" style={{ color: CYBER.ton }}>Total_TON_Pool</div>
          <div className="value" style={{ color: CYBER.ton }}>{stats.totalTonPool.toLocaleString('en-US', {minimumFractionDigits: 2})}<span className="unit">💎</span></div>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>[ Overview ]</button>
        <button className={`tab-btn ${activeTab === 'airdrop' ? 'active' : ''}`} onClick={() => setActiveTab('airdrop')}>[ Airdrop ]</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* ТАПЕРЫ */}
            <div className="card">
              <div className="label">Live_Tappers</div>
              <div className="value">{stats.activeTappers}<span className="unit">⚡</span></div>
              <MiniChart data={history.tappers} color={CYBER.success} />
            </div>

            {/* КОНВЕРСИЯ */}
            <div className="card">
              <div className="label">Wallets_Linked</div>
              <div className="value">{stats.linkedWallets}<span className="unit">🔗</span></div>
              <div style={{ fontSize: '9px', marginTop: '10px', color: CYBER.primary }}>
                {((stats.linkedWallets / stats.totalUsers) * 100).toFixed(1)}% of {stats.totalUsers}
              </div>
            </div>

            {/* ПРИТОК TON */}
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="label">Pool_Activity_Inflow</div>
                <div style={{ color: CYBER.success, fontSize: '12px' }}>+{stats.tonInflow.toFixed(4)} TON/sec</div>
              </div>
              <MiniChart data={history.tonInflow} color={CYBER.ton} height={35} />
            </div>

            {/* СИСТЕМНЫЕ РЕСУРСЫ */}
            <div className="card">
              <div className="label">CPU_Load</div>
              <div className="value">{stats.load.toFixed(1)}%</div>
              <MiniChart data={history.load} color={CYBER.primary} />
            </div>
            <div className="card">
              <div className="label">Latency</div>
              <div className="value">{stats.lat.toFixed(0)}ms</div>
              <MiniChart data={history.lat} color={CYBER.warning} />
            </div>
          </div>

          <div className="card">
            <div className="label">Memory_Usage</div>
            <div style={{ width: '100%', height: '4px', background: '#111', marginTop: '12px' }}>
              <div style={{ width: `${stats.ram}%`, height: '100%', background: CYBER.primary }} />
            </div>
            <div style={{ textAlign: 'right', fontSize: '9px', marginTop: '4px' }}>{stats.ram}% (Static Allocation)</div>
          </div>

          <button className="emergency-btn" onClick={() => setIsEmergency(!isEmergency)}>
            {isEmergency ? 'REBOOT_OS' : 'EMERGENCY_STOP'}
          </button>
        </>
      )}

      {activeTab === 'airdrop' && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="label">Database_Module</div>
          <div style={{ fontSize: '12px', marginTop: '10px', opacity: 0.5 }}>[ SEARCH_INPUT_LOCKED ]</div>
        </div>
      )}

      <footer style={{ textAlign: 'center', fontSize: '8px', opacity: 0.2, marginTop: '20px' }}>
        NEURAL_PULSE_NETWORK // SECURED_TERMINAL_2026
      </footer>
    </div>
  );
};

export default Dashboard;
