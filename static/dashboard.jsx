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

// Вспомогательный компонент для отрисовки линии графика
const MiniChart = ({ data, color, height = 30 }) => {
  if (!data || data.length < 2) return <div style={{ height: height + 10 }} />;
  
  // Очистка данных от NaN и бесконечности
  const cleanData = data.map(v => Number.isFinite(v) ? v : 0);
  const max = Math.max(...cleanData) || 1;
  const min = Math.min(...cleanData);
  const range = (max - min) || 1;
  
  const points = cleanData.map((val, i) => ({
    x: (i / (cleanData.length - 1)) * 100,
    y: height - ((val - min) / range) * height
  }));

  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <svg width="100%" height={height} style={{ marginTop: '10px', overflow: 'visible', display: 'block' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.8" />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.1" />
    </svg>
  );
};

const Dashboard = (props) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState(['> INITIALIZING_BOOT_SEQUENCE...']);
  const [scanPos, setScanPos] = useState(0);
  const [history, setHistory] = useState([]);

  const [stats, setStats] = useState({
    totalUsers: props.data?.totalUsers || 0,
    dailyUsers: props.data?.dailyUsers || 0,
    walletsLinked: props.data?.walletsLinked || 0,
    totalTon: props.data?.totalTon || "0.00",
    cpu: 0,
    mem: 0,
    latency: 5
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!window.AdminJS?.ApiClient) return;
        const api = new window.AdminJS.ApiClient();
        const response = await api.getDashboard();
        const d = response.data || {};
        
        const historyData = d.history || [];
        setHistory(historyData);

        const latest = historyData[historyData.length - 1] || {};

        setStats({
          totalUsers: d.totalUsers || 0,
          dailyUsers: d.dailyUsers || 0,
          walletsLinked: d.walletsLinked || 0,
          totalTon: d.totalTon || "0.00",
          cpu: latest.server_load || 0,
          mem: latest.mem_usage || 0,
          latency: latest.db_latency || 5
        });
        
        setLogs(l => [...l.slice(-9), `> SYNC_OK: ${new Date().toLocaleTimeString()}`]);
      } catch (e) { 
        setLogs(l => [...l.slice(-5), '> TELEMETRY_LINK_LOST']);
      }
    };

    // Симуляция загрузки системных ресурсов
    const loader = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(loader);
          setTimeout(() => setIsReady(true), 200);
          return 100;
        }
        return prev + 5;
      });
    }, 50);

    const interval = setInterval(fetchStats, 10000); // Обновление раз в 10 сек
    const anim = setInterval(() => setScanPos(p => (p + 1) % 100), 60);
    
    fetchStats();
    
    return () => { 
      clearInterval(loader); 
      clearInterval(interval); 
      clearInterval(anim); 
    };
  }, []);

  const StatCard = ({ label, value, unit, color, subValue, historyKey }) => {
    const chartData = history.map(h => h[historyKey] || 0);
    return (
      <div style={{ 
        flex: '1 1 240px', margin: '10px', padding: '20px', 
        background: CYBER.card, border: `1px solid ${color}33`, borderRadius: '4px',
        position: 'relative', overflow: 'hidden',
        boxShadow: `inset 0 0 15px ${color}05`
      }}>
        <div style={{ color: '#8b949e', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px', fontWeight: 'bold' }}>{label}</div>
        <div style={{ color: '#fff', fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', fontFamily: 'monospace' }}>
          {value}
          <span style={{ fontSize: '14px', color: color, marginLeft: '6px' }}>{unit}</span>
        </div>
        
        <MiniChart data={chartData} color={color} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '10px', color: color, opacity: 0.8 }}>{subValue || 'SYSTEM_ACTIVE'}</span>
            <span style={{ fontSize: '9px', color: '#444' }}>LIVE_FEED</span>
        </div>
        
        <div style={{ width: '100%', height: '2px', background: '#000', marginTop: '8px' }}>
          <div style={{ 
            width: `${Math.min(value > 100 ? 100 : value, 100)}%`, height: '100%', 
            background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s ease' 
          }} />
        </div>
      </div>
    );
  };

  if (!isReady) {
    return (
      <div style={{ background: CYBER.bg, color: CYBER.primary, height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center', border: `1px solid ${CYBER.primary}33`, padding: '40px', background: CYBER.card }}>
          <div style={{ fontSize: '10px', letterSpacing: '5px', marginBottom: '20px' }}>NEURAL_PULSE_BOOT</div>
          <div style={{ fontSize: '48px', fontWeight: 'bold' }}>{loadingProgress}%</div>
          <div style={{ width: '200px', height: '2px', background: '#080a0f', margin: '20px auto' }}>
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
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50% { transform: scaleY(1.2); opacity: 1; }
        }
      `}</style>

      {/* ВЕРХНИЙ HUD */}
      <div style={{ background: CYBER.card, padding: '25px', borderRadius: '4px', border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '1px', height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.3, zIndex: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
          <div>
            <span style={{ padding: '2px 8px', background: CYBER.primary, color: '#000', fontWeight: 'bold', fontSize: '10px' }}>NEURAL_PULSE_OS_V3</span>
            <h2 style={{ color: CYBER.primary, margin: '10px 0 0 0', fontSize: '24px', letterSpacing: '1px' }}>CORE_TELEMETRY</h2>
          </div>
          <div style={{ textAlign: 'right', minWidth: '150px' }}>
            <div style={{ color: CYBER.ton, fontWeight: 'bold', fontSize: '20px', whiteSpace: 'nowrap' }}>{stats.totalTon} TON</div>
            <div style={{ color: '#444', fontSize: '9px', letterSpacing: '1px' }}>TOTAL_NETWORK_RESERVE</div>
          </div>
        </div>
      </div>

      {/* СЕТКА КАРТОЧЕК */}
      <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0 -10px' }}>
        <StatCard label="TOTAL_AGENTS" value={stats.totalUsers} unit="U" color={CYBER.primary} historyKey="user_count" />
        <StatCard label="NEW_PLAYERS_24H" value={stats.dailyUsers} unit="+" color={CYBER.success} subValue="↑ ACTIVITY_GROWTH" historyKey="user_count" />
        <StatCard label="WALLETS_LINKED" value={stats.walletsLinked} unit="W" color={CYBER.ton} subValue="TON_CONNECT_READY" historyKey="active_wallets" />
        <StatCard label="CORE_LOAD" value={Number(stats.cpu).toFixed(1)} unit="%" color={CYBER.secondary} historyKey="server_load" />
        <StatCard label="MEM_USAGE" value={Math.round(stats.mem)} unit="MB" color={CYBER.warning} historyKey="mem_usage" />
        <StatCard label="SIGNAL_LATENCY" value={stats.latency} unit="MS" color={CYBER.danger} historyKey="db_latency" />
      </div>

      {/* НИЖНИЕ ПАНЕЛИ (ГРАФИК И ЛОГИ) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '20px', gap: '20px' }}>
        <div style={{ flex: '2 1 400px', background: CYBER.card, height: '250px', border: `1px solid ${CYBER.border}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '15px', left: '15px', color: CYBER.primary, fontSize: '10px', opacity: 0.5, letterSpacing: '2px' }}>NETWORK_WAVEFORM_MONITOR</div>
          {[...Array(40)].map((_, i) => (
            <div key={i} style={{
              width: '6px', background: i % 5 === 0 ? CYBER.ton : CYBER.primary, height: '30%', borderRadius: '1px',
              animation: `cyber-pulse 1.5s infinite ease-in-out ${i * 0.05}s`
            }} />
          ))}
        </div>

        <div style={{ flex: '1 1 300px', background: '#05070a', height: '250px', border: `1px solid ${CYBER.border}`, padding: '20px', overflow: 'hidden', borderRadius: '4px' }}>
          <div style={{ color: CYBER.success, fontSize: '10px', marginBottom: '15px', borderBottom: `1px solid ${CYBER.border}`, paddingBottom: '8px', letterSpacing: '1px' }}>LIVE_SYSTEM_LOGS</div>
          <div style={{ fontSize: '10px', lineHeight: '1.6' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ color: log.includes('LOST') ? CYBER.danger : '#4e555d', whiteSpace: 'nowrap' }}>
                {log}
              </div>
            ))}
            <div style={{ color: CYBER.primary }}>> LISTENING_TO_PULSE...</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
