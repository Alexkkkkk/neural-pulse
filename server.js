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

// Компонент живого графика
const MiniChart = ({ data, color, height = 30 }) => {
  if (!data || data.length < 2) return <div style={{ height: height + 10 }} />;
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
    totalUsers: 0, dailyUsers: 0, walletsLinked: 0, totalTon: "0.00",
    cpu: 0, mem: 0, latency: 0
  });

  useEffect(() => {
    // Функция получения данных в реальном времени
    const fetchStats = async () => {
      try {
        if (!window.AdminJS?.ApiClient) return;
        const api = new window.AdminJS.ApiClient();
        const response = await api.getDashboard();
        const d = response.data || {};
        
        const historyData = d.history || [];
        const latest = historyData[historyData.length - 1] || {};

        setHistory(historyData);
        setStats({
          totalUsers: d.totalUsers || 0,
          dailyUsers: d.dailyUsers || 0,
          walletsLinked: d.walletsLinked || 0,
          totalTon: d.totalTon || "0.00",
          cpu: latest.server_load || 0,
          mem: latest.mem_usage || 0,
          latency: latest.db_latency || 0
        });
        
        setLogs(l => [...l.slice(-8), `> SYNC_OK: ${new Date().toLocaleTimeString()}`]);
      } catch (e) { 
        setLogs(l => [...l.slice(-5), '> TELEMETRY_LINK_LOST: RETRYING...']);
      }
    };

    // Анимация загрузки при первом входе
    const loader = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(loader);
          setTimeout(() => setIsReady(true), 200);
          return 100;
        }
        return prev + 10;
      });
    }, 40);

    // Интервалы обновления: Данные (10с) и Сканер (60мс)
    const dataInterval = setInterval(fetchStats, 10000);
    const scanInterval = setInterval(() => setScanPos(p => (p + 1) % 100), 60);
    
    fetchStats(); // Мгновенный первый запрос
    
    return () => { 
      clearInterval(loader); 
      clearInterval(dataInterval); 
      clearInterval(scanInterval); 
    };
  }, []);

  const StatCard = ({ label, value, unit, color, historyKey }) => {
    const chartData = history.map(h => h[historyKey] || 0);
    return (
      <div style={{ 
        flex: '1 1 220px', margin: '10px', padding: '20px', background: CYBER.card, 
        border: `1px solid ${color}33`, borderRadius: '4px', position: 'relative', overflow: 'hidden' 
      }}>
        <div style={{ color: '#8b949e', fontSize: '10px', letterSpacing: '2px', fontWeight: 'bold' }}>{label}</div>
        <div style={{ color: '#fff', fontSize: '26px', fontWeight: 'bold', margin: '10px 0' }}>
          {value}<span style={{ fontSize: '14px', color: color, marginLeft: '5px' }}>{unit}</span>
        </div>
        <MiniChart data={chartData} color={color} />
        <div style={{ width: '100%', height: '2px', background: '#000', marginTop: '10px' }}>
          <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s ease' }} />
        </div>
      </div>
    );
  };

  if (!isReady) {
    return (
      <div style={{ background: CYBER.bg, color: CYBER.primary, height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', letterSpacing: '5px' }}>ESTABLISHING_SECURE_LINK</div>
          <div style={{ fontSize: '60px', fontWeight: 'bold', margin: '20px 0' }}>{loadingProgress}%</div>
          <div style={{ width: '200px', height: '2px', background: '#161b22' }}>
            <div style={{ width: `${loadingProgress}%`, height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace', padding: '20px' }}>
      <style>{`#adminjs, body, html { background-color: ${CYBER.bg} !important; }`}</style>

      {/* HEADER HUD */}
      <div style={{ background: CYBER.card, padding: '20px', border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '1px', height: '100%', background: CYBER.primary, opacity: 0.3 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ background: CYBER.primary, color: '#000', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold', display: 'inline-block' }}>NP_OS_v3.0</div>
            <h2 style={{ color: CYBER.primary, margin: '10px 0 0 0' }}>SYSTEM_TELEMETRY</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: CYBER.ton, fontSize: '22px', fontWeight: 'bold' }}>{stats.totalTon} TON</div>
            <div style={{ color: '#444', fontSize: '9px' }}>NETWORK_RESERVE_ACTIVE</div>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0 -10px' }}>
        <StatCard label="TOTAL_USERS" value={stats.totalUsers} unit="U" color={CYBER.primary} historyKey="user_count" />
        <StatCard label="NEW_24H" value={stats.dailyUsers} unit="+" color={CYBER.success} historyKey="user_count" />
        <StatCard label="WALLETS" value={stats.walletsLinked} unit="W" color={CYBER.ton} historyKey="active_wallets" />
        <StatCard label="CPU_LOAD" value={stats.cpu.toFixed(1)} unit="%" color={CYBER.secondary} historyKey="server_load" />
        <StatCard label="MEMORY" value={Math.round(stats.mem)} unit="MB" color={CYBER.warning} historyKey="mem_usage" />
        <StatCard label="LATENCY" value={stats.latency} unit="MS" color={CYBER.danger} historyKey="db_latency" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '10px' }}>
        {/* WAVEFORM ANIMATION */}
        <div style={{ flex: '2 1 400px', background: CYBER.card, height: '200px', border: `1px solid ${CYBER.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          {[...Array(30)].map((_, i) => (
            <div key={i} style={{
              width: '5px', background: CYBER.primary, height: '40%', opacity: 0.5,
              animation: `cyber-pulse 1.5s infinite ease-in-out ${i * 0.05}s`
            }} />
          ))}
          <style>{`@keyframes cyber-pulse { 0%, 100% { height: 20%; opacity: 0.3; } 50% { height: 60%; opacity: 1; } }`}</style>
        </div>

        {/* REAL-TIME LOGS */}
        <div style={{ flex: '1 1 300px', background: '#05070a', height: '200px', border: `1px solid ${CYBER.border}`, padding: '15px', overflow: 'hidden' }}>
          <div style={{ color: CYBER.success, fontSize: '10px', marginBottom: '10px', borderBottom: `1px solid ${CYBER.border}` }}>CORE_LOG_STREAM</div>
          {logs.map((log, i) => (
            <div key={i} style={{ color: log.includes('LOST') ? CYBER.danger : '#4e555d', fontSize: '10px', marginBottom: '4px' }}>{log}</div>
          ))}
          <div style={{ color: CYBER.primary, fontSize: '10px' }}>> _</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
