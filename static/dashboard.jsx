import React, { useState, useEffect, memo, useRef } from 'react';
/* 1. Импортируем необходимые компоненты TON */
import { 
  TonConnectUIProvider, 
  TonConnectButton, 
  useTonAddress 
} from '@tonconnect/ui-react';

// --- 🌌 NEURAL_PULSE ULTIMATE DARK PALETTE ---
const CYBER = {
  bg: '#000000',
  card: '#05070a',
  primary: '#00f2fe',
  ton: '#0088CC',
  success: '#39ff14',
  danger: '#ff003c',
  warning: '#ffea00',
  secondary: '#7000ff',
  text: '#e2e8f0',
  subtext: '#4a5568',
  border: '#11151c',
};

// --- 📈 UNIVERSAL SPARKLINE COMPONENT ---
const SparkGraph = memo(({ data, color, height = 35 }) => {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * height,
  }));
  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L 100,${height} L 0,${height} Z`;
  return (
    <svg width="100%" height={height} style={{ marginTop: '15px', overflow: 'visible', filter: `drop-shadow(0 0 3px ${color}44)` }}>
      <path d={areaPath} fill={`${color}11`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="100" cy={points[points.length-1].y} r="2" fill={color} />
    </svg>
  );
});

// --- 📊 PROGRESS BAR COMPONENT ---
const TelemetryBar = ({ label, value, color }) => (
  <div style={{ flex: 1 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}%</span>
    </div>
    <div style={{ width: '100%', height: '3px', background: '#111', borderRadius: '1px' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, boxShadow: `0 0 8px ${color}55`, transition: 'width 1s ease-in-out' }} />
    </div>
  </div>
);

/* Основной контент дашборда */
const DashboardContent = (props) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const logRef = useRef(null);
  
  /* 2. Получаем адрес кошелька для логов */
  const userAddress = useTonAddress();

  const [stats, setStats] = useState({
    cpu: 14, ram: 38, ssd: 22,
    online: 42, liquidity: 1000,
    latency: 101, ton: 65.5
  });

  const [history, setHistory] = useState({
    cpu: [12, 15, 14, 18, 16, 14, 14],
    online: [38, 40, 42, 41, 43, 42, 42],
    wallets: [840, 842, 845, 848, 850, 850, 850],
    liq: [980, 990, 1000, 1000, 1000, 1000, 1000]
  });

  const [logs, setLogs] = useState(['> UPLINK_ESTABLISHED', '> SECURE_ENCRYPTED_SESSION_ACTIVE']);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpu: Math.floor(Math.random() * 5 + 12),
        latency: Math.floor(Math.random() * 10 + 95)
      }));
    }, 3000);
    setTimeout(() => setIsLoaded(true), 800);
    return () => clearInterval(interval);
  }, []);

  // Добавляем запись в лог при подключении кошелька
  useEffect(() => {
    if (userAddress) {
      setLogs(prev => [...prev, `> WALLET_CONNECTED: ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`]);
    }
  }, [userAddress]);

  if (!isLoaded) return <div style={{ background: '#000', height: '100vh' }} />;

  return (
    <div className={`app-root ${isEmergency ? 'emergency' : ''}`}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />
      
      <style>{`
        .app-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'Roboto Mono', monospace; color: ${CYBER.text}; transition: 0.5s; }
        .header { margin-bottom: 30px; border-left: 3px solid ${CYBER.primary}; padding-left: 15px; display: flex; justify-content: space-between; align-items: flex-start; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 18px; border-radius: 2px; position: relative; overflow: hidden; }
        .label { font-size: 9px; color: ${CYBER.primary}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: bold; }
        .val-main { font-size: 28px; font-weight: bold; color: #fff; line-height: 1; }
        .val-unit { font-size: 11px; color: ${CYBER.subtext}; margin-left: 4px; }
        .op-btn { background: #fff; color: #000; border: none; padding: 14px; font-size: 11px; font-weight: 800; cursor: pointer; text-transform: uppercase; transition: 0.2s; border-radius: 1px; }
        .op-btn:active { opacity: 0.7; transform: translateY(1px); }
        .emergency { filter: saturate(0) contrast(1.5) brightness(0.8) hue-rotate(-160deg); }
        
        /* Стилизация кнопки TON под дизайн */
        .ton-connect-btn button { background: ${CYBER.ton} !important; border-radius: 2px !important; color: white !important; font-family: 'Roboto Mono' !important; }
      `}</style>

      {/* --- HEADER --- */}
      <div className="header">
        <div>
          <h1 style={{ color: CYBER.primary, fontSize: '24px', margin: 0, letterSpacing: '4px', fontWeight: 900 }}>NEURAL_PULSE</h1>
          <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '4px' }}>
            <span style={{ color: CYBER.success }}>●</span> UPLINK_ESTABLISHED // NODE: TITAN_01
          </div>
        </div>
        
        {/* 3. Кнопка подключения кошелька (действует как ссылка) */}
        <div className="ton-connect-btn">
          <TonConnectButton />
        </div>
      </div>

      <div className="grid">
        {/* HARDWARE */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label">System_Hardware_Telemetry</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <TelemetryBar label="Kernel" value={stats.cpu} color={CYBER.primary} />
            <TelemetryBar label="Memory" value={stats.ram} color={CYBER.secondary} />
            <TelemetryBar label="SSD" value={stats.ssd} color={CYBER.warning} />
          </div>
        </div>

        {/* AGENTS */}
        <div className="card">
          <div className="label">Active_Agents</div>
          <div className="val-main">{stats.online}<span className="val-unit">U</span></div>
          <SparkGraph data={history.online} color={CYBER.success} />
        </div>

        {/* TON POOL */}
        <div className="card">
          <div className="label">Ton_Pool</div>
          <div className="val-main">{stats.ton}<span className="val-unit">💎</span></div>
          <SparkGraph data={history.wallets} color={CYBER.ton} />
        </div>

        {/* LATENCY */}
        <div className="card">
          <div className="label" style={{ color: CYBER.danger }}>I/O_Latency</div>
          <div className="val-main">{stats.latency}<span className="val-unit">ms</span></div>
          <SparkGraph data={history.cpu} color={CYBER.danger} />
        </div>

        {/* LIQUIDITY */}
        <div className="card">
          <div className="label">Total_Liquidity</div>
          <div className="val-main">{stats.liquidity}<span className="val-unit">$NP</span></div>
          <SparkGraph data={history.liq} color={CYBER.warning} />
        </div>

        {/* OPERATIONS */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="label">Core_Operations</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button className="op-btn" onClick={() => setLogs(p => [...p, `> BROADCAST_SENT: ${new Date().toLocaleTimeString()}`])}>📢 Broadcast</button>
            <button className="op-btn" onClick={() => setLogs(p => [...p, `> CACHE_PURGED: OK`])}>🧹 Purge</button>
            <button className="op-btn" onClick={() => setLogs(p => [...p, `> DB_SYNC: COMPLETE`])}>💾 Sync</button>
            <button className="op-btn" style={{ background: isEmergency ? CYBER.danger : '#fff', color: isEmergency ? '#fff' : '#000' }} onClick={() => setIsEmergency(!isEmergency)}>⚠️ Kill_Switch</button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ marginTop: '20px', borderTop: `1px solid ${CYBER.border}`, paddingTop: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '10px' }}>
          <span style={{ color: CYBER.primary }}>[ LIVE_SYSTEM_FEED ]</span>
          <span style={{ opacity: 0.3 }}>SECURE_SESSION_ACTIVE</span>
        </div>
        <div ref={logRef} style={{ height: '60px', overflowY: 'auto', fontSize: '10px', opacity: 0.4, lineHeight: '1.6' }}>
          {logs.slice(-3).map((l, i) => <div key={i}>{l}</div>)}
          <div>{`> MONITORING_UPDATE: DELTA_${Math.floor(Math.random()*9999)}`}</div>
        </div>
      </footer>
    </div>
  );
};

/* 4. Обертка всего приложения в Провайдер */
const Dashboard = (props) => (
  <TonConnectUIProvider manifestUrl="https://np.bothost.tech/tonconnect-manifest.json">
    <DashboardContent {...props} />
  </TonConnectUIProvider>
);

export default Dashboard;
