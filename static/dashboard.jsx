import React, { useState, useEffect, memo } from 'react';

// --- 🌌 OMNI-CYBER PALETTE V9.8 (PIXEL PERFECT) ---
const CYBER = {
  bg: '#000000',
  cardBg: '#0a0f1d',
  cardBorder: '#1a1f2e',
  textMain: '#ffffff',
  textSecondary: '#6b7280',
  primary: '#00f2fe',  // Core Node
  purple: '#bc13fe',   // Sync Memory
  yellow: '#f3ff00',   // Stability / Liquidity
  green: '#00ff9f',    // Active Agents
  blue: '#0088cc',     // TON Reserve
  red: '#ff0055',      // Network Latency
};

// --- 📈 КОМПОНЕНТ ЖИВОГО ГРАФИКА (SPARKLINE) ---
const Sparkline = memo(({ data, color, height = 40 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  
  const width = 100; // Относительные единицы SVG
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - (val / 100) * (height * 0.8) - 4
  }));
  
  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height, width: '100%', overflow: 'visible', marginTop: '10px' }}>
      <defs>
        <filter id={`glow-${color.replace('#','')}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#glow-${color.replace('#','')})`}
      />
      <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="2.5" fill={color} />
    </svg>
  );
});

// --- ✨ НЕОНОВЫЙ ЛИНЕЙНЫЙ ИНДИКАТОР (Для сетки) ---
const GlowBar = memo(({ color, percent }) => (
  <div className="glow-bar-container">
    <div 
      className="glow-bar-fill" 
      style={{ 
        width: `${Math.min(percent, 100)}%`, 
        backgroundColor: color,
        boxShadow: `0 0 12px ${color}` 
      }} 
    />
  </div>
));

// --- 💎 КАРТОЧКА МЕТРИКИ (С поддержкой графиков) ---
const MetricCard = ({ label, value, unit, color, data, percent, isSmall = false }) => (
  <div className={`metric-card ${isSmall ? 'small-card' : ''}`}>
    <div className="card-header-row">
      <span className="q-label" style={isSmall ? { color } : {}}>{label}</span>
      <span className="q-val" style={!isSmall && percent > 0 ? { color } : {}}>
        {value}<span className="q-unit">{unit}</span>
      </span>
    </div>
    {isSmall ? (
      <GlowBar color={color} percent={percent} />
    ) : (
      <Sparkline data={data} color={color} />
    )}
  </div>
);

// --- 🛠️ ОСНОВНОЙ КОМПОНЕНТ ДЕШБОРДА ---
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ 
    cpu: 3, ram: 140.2, stability: 96, 
    agents: 0, ton: 0.0, liquidity: 0, latency: 0 
  });

  // История для графиков (имитация накопления данных)
  const [history, setHistory] = useState({
    cpu: [20, 45, 30, 55, 40, 25, 35, 30],
    ram: [15, 20, 18, 22, 20, 25, 23, 40],
    stability: [70, 85, 60, 90, 80, 95, 85, 96]
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpu: Math.floor(Math.random() * 12),
        ram: (138 + Math.random() * 5).toFixed(1),
        stability: 94 + Math.floor(Math.random() * 6)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="omni-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;700&display=swap');
        
        body { margin: 0; background: ${CYBER.bg}; color: ${CYBER.textMain}; font-family: 'Inter', sans-serif; overflow-x: hidden; }
        .omni-app { min-height: 100vh; padding: 20px; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; }

        /* Шапка */
        .omni-header { margin-bottom: 25px; }
        .omni-logo { 
          font-family: 'Orbitron', sans-serif; 
          font-weight: 900; 
          font-size: 28px; 
          letter-spacing: 1px; 
          color: ${CYBER.primary}; 
          text-transform: uppercase;
        }
        .status-badge { 
          font-size: 10px; 
          color: ${CYBER.green}; 
          margin-top: 6px; 
          font-weight: 700;
          display: flex; 
          align-items: center; 
          gap: 6px; 
          letter-spacing: 0.5px;
        }
        .dot { width: 6px; height: 6px; background: ${CYBER.green}; border-radius: 50%; box-shadow: 0 0 10px ${CYBER.green}; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

        /* Навигация */
        .omni-tabs { display: flex; gap: 20px; border-bottom: 1px solid #1a1f2e; margin-bottom: 20px; }
        .omni-tab { 
          background: none; border: none; color: ${CYBER.textSecondary}; 
          padding: 10px 0; cursor: pointer; font-size: 11px; font-weight: 700; 
          position: relative; text-transform: uppercase; transition: 0.3s;
        }
        .omni-tab.active { color: ${CYBER.primary}; }
        .omni-tab.active::after { 
          content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: ${CYBER.primary}; 
        }

        /* Карточки */
        .metric-card { 
          background: ${CYBER.cardBg}; 
          border: 1px solid ${CYBER.cardBorder}; 
          padding: 18px 22px; 
          border-radius: 12px; 
          margin-bottom: 12px; 
        }
        .card-header-row { display: flex; justify-content: space-between; align-items: center; }
        .q-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: ${CYBER.textSecondary}; letter-spacing: 0.5px; }
        .q-val { font-size: 15px; font-weight: 700; }
        .q-unit { font-size: 10px; margin-left: 2px; opacity: 0.7; }

        /* Сетка 2x2 */
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .small-card { padding: 15px; }
        .small-card .q-val { font-size: 30px; display: block; margin: 8px 0; }
        .small-card .q-unit { font-size: 10px; color: ${CYBER.textSecondary}; margin-left: 5px; }

        .glow-bar-container { height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; margin-top: 5px; }
        .glow-bar-fill { height: 100%; transition: width 0.8s ease; }

        /* Таблица агентов */
        .agent-table { font-size: 11px; width: 100%; }
        .agent-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #111; }
        .agent-id { color: ${CYBER.primary}; font-family: monospace; font-weight: bold; }
        .status-ok { color: ${CYBER.green}; }

        footer { margin-top: auto; padding: 25px 0 10px; border-top: 1px solid #111; font-size: 9px; color: ${CYBER.textSecondary}; display: flex; justify-content: space-between; opacity: 0.6; }
      `}</style>

      <header className="omni-header">
        <div className="omni-logo">NEURAL_PULSE V9.8</div>
        <div className="status-badge">
          <div className="dot"></div>
          SYSTEM_OPERATIONAL // REALTIME_SYNC
        </div>
      </header>

      <nav className="omni-tabs">
        <button 
          className={`omni-tab ${activeTab === 'overview' ? 'active' : ''}`} 
          onClick={() => setActiveTab('overview')}
        >
          OVERVIEW
        </button>
        <button 
          className={`omni-tab ${activeTab === 'agents' ? 'active' : ''}`} 
          onClick={() => setActiveTab('agents')}
        >
          AGENT_DATABASE
        </button>
      </nav>

      <main className="main-layout">
        {activeTab === 'overview' ? (
          <>
            {/* Верхние карточки с графиками */}
            <MetricCard 
              label="CORE_NODE_LOAD" 
              value={stats.cpu} 
              unit="%" 
              color={CYBER.primary} 
              data={history.cpu} 
              percent={stats.cpu} 
            />
            <MetricCard 
              label="SYNC_MEMORY" 
              value={stats.ram} 
              unit="MB" 
              color={CYBER.purple} 
              data={history.ram} 
              percent={40} 
            />
            <MetricCard 
              label="STABILITY" 
              value={stats.stability} 
              unit="%" 
              color={CYBER.yellow} 
              data={history.stability} 
              percent={stats.stability} 
            />

            {/* Нижняя сетка 2x2 */}
            <div className="stats-grid">
              <MetricCard isSmall label="ACTIVE_AGENTS" value={stats.agents} unit="USERS" color={CYBER.green} percent={15} />
              <MetricCard isSmall label="TON_RESERVE" value={stats.ton.toFixed(1)} unit="💎 TON" color={CYBER.blue} percent={10} />
              <MetricCard isSmall label="PULSE_LIQUIDITY" value={stats.liquidity} unit="GND" color={CYBER.yellow} percent={5} />
              <MetricCard isSmall label="NETWORK_LATENCY" value={stats.latency} unit="MS" color={CYBER.red} percent={5} />
            </div>
          </>
        ) : (
          <div className="metric-card">
            <div className="q-label" style={{marginBottom: '15px'}}>Active Neural Nodes</div>
            <div className="agent-table">
              <div className="agent-row" style={{opacity: 0.5}}><span>IDENTIFIER</span><span>STATUS</span><span>UPTIME</span></div>
              <div className="agent-row">
                <span className="agent-id">#NP_CORE_MAIN</span>
                <span className="status-ok">ONLINE</span>
                <span>42h 15m</span>
              </div>
              <div className="agent-row">
                <span className="agent-id">#NP_NODE_NL4</span>
                <span className="status-ok">ONLINE</span>
                <span>12h 04m</span>
              </div>
              <div className="agent-row">
                <span className="agent-id">#NP_RELAY_V4</span>
                <span className="status-ok">ONLINE</span>
                <span>08h 51m</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer>
        <div>V9.8_STABLE // CRYPTO_NEURAL_OPERATIONS</div>
        <div>OPERATOR: KANDERKANDER</div>
      </footer>
    </div>
  );
};

export default Dashboard;
