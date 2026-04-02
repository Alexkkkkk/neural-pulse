import React, { useState, useEffect, memo } from 'react';

// --- 🌌 ТОЧНАЯ ПАЛИТРА ИЗ СКРИНШОТОВ (V9.8) ---
const CYBER = {
  bg: '#000000',
  cardBg: '#0a0f1d',
  cardBorder: '#1a1f2e',
  textMain: '#ffffff',
  textSecondary: '#6b7280',
  primary: '#00f2fe',  // Голубой (Node Load)
  purple: '#bc13fe',   // Фиолетовый (Memory)
  yellow: '#f3ff00',   // Желтый (Stability / Liquidity)
  green: '#00ff9f',    // Зеленый (Active Agents)
  blue: '#0088cc',     // Синий (TON Reserve)
  red: '#ff0055',      // Красный (Latency)
  glow: 'rgba(0, 242, 254, 0.3)',
};

// --- ✨ НЕОНОВЫЙ ЛИНЕЙНЫЙ ИНДИКАТОР ---
const GlowBar = memo(({ color, percent }) => (
  <div className="glow-bar-container">
    <div 
      className="glow-bar-fill" 
      style={{ 
        width: `${percent}%`, 
        backgroundColor: color,
        boxShadow: `0 0 12px ${color}` 
      }} 
    />
  </div>
));

// --- 💎 ОСНОВНАЯ КАРТОЧКА МЕТРИКИ (С точностью до пикселя) ---
const MetricCard = ({ label, value, unit, color, percent }) => (
  <div className="metric-card">
    <div className="card-header-row">
      <span className="q-label">{label}</span>
      <span className="q-val" style={{ color: percent > 0 ? color : CYBER.textMain }}>
        {value}<span className="q-unit">{unit}</span>
      </span>
    </div>
    <GlowBar color={color} percent={percent} />
  </div>
);

// --- 🛠️ ОСНОВНОЙ КОМПОНЕНТ ДЕШБОРДА ---
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ 
    cpu: 0, ram: 0, stability: 100, 
    agents: 0, ton: 0.0, liquidity: 0, latency: 0 
  });

  // Эмуляция потока данных (аналог вашего EventSource)
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpu: Math.floor(Math.random() * 10),
        ram: (140 + Math.random() * 5).toFixed(1),
        stability: 95 + Math.floor(Math.random() * 5)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="omni-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;700&display=swap');
        
        body { margin: 0; background: ${CYBER.bg}; color: ${CYBER.textMain}; font-family: 'Inter', sans-serif; }
        .omni-app { min-height: 100vh; padding: 20px; max-width: 500px; margin: 0 auto; }

        /* Шапка V9.8 */
        .omni-header { margin-bottom: 30px; }
        .omni-logo { 
          font-family: 'Orbitron', sans-serif; 
          font-weight: 900; 
          font-size: 32px; 
          letter-spacing: 2px; 
          color: ${CYBER.primary}; 
          text-transform: uppercase;
        }
        .status-badge { 
          font-size: 10px; 
          color: ${CYBER.green}; 
          margin-top: 8px; 
          font-weight: 700;
          display: flex; 
          align-items: center; 
          gap: 6px; 
        }
        .dot { width: 6px; height: 6px; background: ${CYBER.green}; border-radius: 50%; box-shadow: 0 0 8px ${CYBER.green}; }

        /* Навигация */
        .omni-tabs { display: flex; gap: 25px; border-bottom: 1px solid #1f2937; margin-bottom: 25px; }
        .omni-tab { 
          background: none; border: none; color: ${CYBER.textSecondary}; 
          padding: 12px 0; cursor: pointer; font-size: 12px; font-weight: 700; 
          position: relative; text-transform: uppercase;
        }
        .omni-tab.active { color: ${CYBER.primary}; }
        .omni-tab.active::after { 
          content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: ${CYBER.primary}; 
        }

        /* Карточки */
        .metric-card { 
          background: ${CYBER.cardBg}; 
          border: 1px solid ${CYBER.cardBorder}; 
          padding: 22px; 
          border-radius: 14px; 
          margin-bottom: 15px; 
        }
        .card-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .q-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: ${CYBER.textSecondary}; letter-spacing: 0.5px; }
        .q-val { font-size: 16px; font-weight: 700; }
        .q-unit { font-size: 10px; margin-left: 3px; opacity: 0.8; }

        /* Полоса прогресса */
        .glow-bar-container { height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; }
        .glow-bar-fill { height: 100%; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }

        /* Сетка 2x2 */
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .small-card { padding: 18px; }
        .small-card .q-val { font-size: 32px; display: block; margin: 10px 0; }
        .small-card .q-unit { font-size: 11px; color: ${CYBER.textSecondary}; text-transform: uppercase; margin-left: 8px; }

        footer { margin-top: 40px; padding: 20px 0; border-top: 1px solid #111; font-size: 9px; color: ${CYBER.textSecondary}; display: flex; justify-content: space-between; opacity: 0.5; }
      `}</style>

      <header className="omni-header">
        <div className="omni-logo">NEURAL_PULSE V9.8</div>
        <div className="status-badge">
          <div className="dot"></div>
          SYSTEM_OPERATIONAL // SECURE_LINK_V4
        </div>
      </header>

      <nav className="omni-tabs">
        <button className={`omni-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>OVERVIEW</button>
        <button className={`tab-agent omni-tab`}>AGENT_DATABASE</button>
      </nav>

      <main className="main-layout">
        {/* Верхний стек (Linear) */}
        <MetricCard label="CORE_NODE_LOAD" value={stats.cpu} unit="%" color={CYBER.primary} percent={stats.cpu || 3} />
        <MetricCard label="SYNC_MEMORY" value={stats.ram} unit="MB" color={CYBER.purple} percent={40} />
        <MetricCard label="STABILITY" value={stats.stability} unit="%" color={CYBER.yellow} percent={stats.stability} />

        {/* Нижняя сетка (Grid 2x2) */}
        <div className="stats-grid">
          <div className="metric-card small-card">
            <div className="q-label" style={{ color: CYBER.green }}>ACTIVE_AGENTS</div>
            <span className="q-val">{stats.agents}<span className="q-unit">USERS</span></span>
            <GlowBar color={CYBER.green} percent={15} />
          </div>

          <div className="metric-card small-card">
            <div className="q-label" style={{ color: CYBER.blue }}>TON_RESERVE</div>
            <span className="q-val">{stats.ton.toFixed(1)}<span className="q-unit">💎 TON</span></span>
            <GlowBar color={CYBER.blue} percent={10} />
          </div>

          <div className="metric-card small-card">
            <div className="q-label" style={{ color: CYBER.yellow }}>PULSE_LIQUIDITY</div>
            <span className="q-val">{stats.liquidity}<span className="q-unit">GND</span></span>
            <GlowBar color={CYBER.yellow} percent={5} />
          </div>

          <div className="metric-card small-card">
            <div className="q-label" style={{ color: CYBER.red }}>NETWORK_LATENCY</div>
            <span className="q-val">{stats.latency}<span className="q-unit">MS</span></span>
            <GlowBar color={CYBER.red} percent={5} />
          </div>
        </div>
      </main>

      <footer>
        <div>V9.8_STABLE // CRYPTO_NEURAL_OPERATIONS</div>
        <div>OPERATOR: KANDERKANDER</div>
      </footer>
    </div>
  );
};

export default Dashboard;
