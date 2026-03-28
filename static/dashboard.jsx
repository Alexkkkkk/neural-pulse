import React, { useState, useEffect } from 'react';

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

// Вспомогательный компонент для отрисовки линии графика внутри карточки
const MiniChart = ({ data, color, height = 30 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data) || 1;
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - ((val - min) / range) * height
  }));

  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.05" />
    </svg>
  );
};

const Dashboard = (props) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [forceMode, setForceMode] = useState(false);
  const [logs, setLogs] = useState(['> INITIALIZING_BOOT_SEQUENCE...']);
  const [scanPos, setScanPos] = useState(0);
  const [history, setHistory] = useState([]); // История для графиков

  const [stats, setStats] = useState({
    totalUsers: props.data?.totalUsers || 0,
    dailyUsers: props.data?.dailyUsers || 0,
    walletsLinked: props.data?.walletsLinked || 0,
    totalTon: props.data?.totalTon || 0,
    cpu: 0,
    mem: 0,
    latency: 5
  });

  useEffect(() => {
    const startTime = Date.now();
    
    const loader = setInterval(() => {
      const dsLoaded = !!(window.AdminJSDesignSystem && window.AdminJSDesignSystem.Box);
      setLoadingProgress(prev => {
        if (dsLoaded) {
          if (prev >= 100) {
            clearInterval(loader);
            setIsReady(true);
            return 100;
          }
          return prev + 15;
        }
        if (Date.now() - startTime > 5000) {
          clearInterval(loader);
          setForceMode(true);
          setTimeout(() => setIsReady(true), 500);
          return 100;
        }
        return prev < 95 ? prev + 1 : prev;
      });
    }, 100);

    const fetchStats = async () => {
      try {
        if (!window.AdminJS?.ApiClient) return;
        const api = new window.AdminJS.ApiClient();
        const response = await api.getDashboard();
        const d = response.data || {};
        
        // История из базы (настроено в db.js на 15-минутные интервалы)
        const historyData = d.history || [];
        setHistory(historyData);

        const latest = historyData[historyData.length - 1] || {};

        setStats({
          totalUsers: d.totalUsers || 0,
          dailyUsers: d.dailyUsers || 0,
          walletsLinked: d.walletsLinked || 0,
          totalTon: d.totalTon || 0,
          cpu: latest.server_load || 0,
          mem: latest.mem_usage || 0,
          latency: latest.db_latency || 5
        });
        
        setLogs(l => [...l.slice(-10), `> SYNC_COMPLETED: ${new Date().toLocaleTimeString()}`]);
      } catch (e) { 
        setLogs(l => [...l.slice(-5), '> TELEMETRY_LINK_LOST']);
      }
    };

    const interval = setInterval(fetchStats, 10000); // Обновляем UI каждые 10 сек
    const anim = setInterval(() => setScanPos(p => (p + 1.2) % 100), 50);
    
    fetchStats(); // Первый вызов
    
    return () => { 
      clearInterval(loader); 
      clearInterval(interval); 
      clearInterval(anim); 
    };
  }, []);

  const StatCard = ({ label, value, unit, color, subValue, historyKey }) => {
    // Извлекаем массив данных для конкретного графика
    const chartData = history.map(h => h[historyKey] || 0);

    return (
      <div style={{ 
        flex: '1 1 200px', margin: '10px', padding: '20px', 
        background: CYBER.card, border: `1px solid ${color}33`, borderRadius: '4px',
        boxShadow: `inset 0 0 15px ${color}08`, position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ color: '#8b949e', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px', fontWeight: 'bold' }}>{label}</div>
        <div style={{ color: '#fff', fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', fontFamily: 'monospace' }}>
          {value}
          <span style={{ fontSize: '14px', color: color, marginLeft: '6px' }}>{unit}</span>
        </div>
        
        {/* Временной график 15-мин интервалов */}
        <MiniChart data={chartData} color={color} />

        {subValue && <div style={{ fontSize: '10px', color: color, marginTop: '8px', opacity: 0.8 }}>{subValue}</div>}
        
        <div style={{ width: '100%', height: '2px', background: '#000', marginTop: '10px' }}>
          <div style={{ 
            width: `${Math.min(value > 100 ? 100 : value, 100)}%`, height: '100%', 
            background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1.5s ease-in-out' 
          }} />
        </div>
      </div>
    );
  };

  if (!isReady) {
    return (
      <div style={{ background: CYBER.bg, color: CYBER.primary, height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
        <div style={{ border: `1px solid ${CYBER.primary}33`, padding: '50px', textAlign: 'center', background: CYBER.card }}>
          <div style={{ fontSize: '12px', color: CYBER.primary, marginBottom: '25px', letterSpacing: '5px' }}>SYSTEM_BOOTING</div>
          <div style={{ fontSize: '72px', fontWeight: 'bold', textShadow: `0 0 20px ${CYBER.primary}44` }}>{loadingProgress}%</div>
          <div style={{ width: '250px', height: '2px', background: '#080a0f', marginTop: '30px' }}>
             <div style={{ width: `${loadingProgress}%`, height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace', padding: '20px' }}>
      <style>{`
        #adminjs, body, html { background-color: ${CYBER.bg} !important; }
        @keyframes cyber-pulse {
          0%, 100% { transform: scaleY(0.4); opacity: 0.4; }
          50% { transform: scaleY(1.3); opacity: 1; }
        }
      `}</style>

      <div style={{ background: CYBER.card, padding: '25px', borderRadius: '4px', border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '2px', height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.4 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ padding: '3px 10px', background: CYBER.primary, color: '#000', fontWeight: 'bold', fontSize: '10px' }}>NEURAL_PULSE_OS_V3</span>
            <h2 style={{ color: CYBER.primary, margin: '12px 0 0 0', fontSize: '26px' }}>CORE_TELEMETRY</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: CYBER.ton, fontWeight: 'bold', fontSize: '18px' }}>{stats.totalTon} TON</div>
            <div style={{ color: '#444', fontSize: '9px' }}>TOTAL_NETWORK_RESERVE</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0 -10px' }}>
        <StatCard label="TOTAL_AGENTS" value={stats.totalUsers} unit="U" color={CYBER.primary} historyKey="user_count" />
        <StatCard label="NEW_PLAYERS_24H" value={stats.dailyUsers} unit="+" color={CYBER.success} subValue="↑ GROWTH" historyKey="user_count" />
        <StatCard label="WALLETS_LINKED" value={stats.walletsLinked} unit="W" color={CYBER.ton} subValue="TON_READY" historyKey="active_wallets" />
        <StatCard label="CORE_LOAD" value={stats.cpu} unit="%" color={CYBER.secondary} historyKey="server_load" />
        <StatCard label="MEM_USAGE" value={stats.mem} unit="MB" color={CYBER.warning} historyKey="mem_usage" />
        <StatCard label="SIGNAL_LATENCY" value={stats.latency} unit="MS" color={CYBER.danger} historyKey="db_latency" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '20px', gap: '20px' }}>
        <div style={{ flex: '2 1 400px', background: CYBER.card, height: '300px', border: `1px solid ${CYBER.border}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '15px', left: '15px', color: CYBER.primary, fontSize: '10px', opacity: 0.6 }}>NETWORK_WAVEFORM</div>
          {[...Array(30)].map((_, i) => (
            <div key={i} style={{
              width: '8px', background: i % 3 === 0 ? CYBER.ton : CYBER.primary, height: '40%', borderRadius: '1px',
              animation: `cyber-pulse 1.2s infinite ease-in-out ${i * 0.04}s`
            }} />
          ))}
        </div>

        <div style={{ flex: '1 1 300px', background: '#05070a', height: '300px', border: `1px solid ${CYBER.border}`, padding: '20px', overflow: 'hidden' }}>
          <div style={{ color: CYBER.success, fontSize: '11px', marginBottom: '15px', borderBottom: `1px solid ${CYBER.border}`, paddingBottom: '8px' }}>LIVE_NETWORK_LOGS</div>
          <div style={{ fontSize: '10px', fontFamily: 'monospace' }}>
            {logs.slice(-10).map((log, i) => (
              <div key={i} style={{ color: log.includes('FAILED') ? CYBER.danger : '#4e555d', marginBottom: '6px' }}>
                {log}
              </div>
            ))}
            <div style={{ color: CYBER.primary }}>> MONITORING_STREAM...</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
