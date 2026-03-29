import React, { useState, useEffect } from 'react';

// --- 🌐 NEURAL PULSE OS COLOR SYSTEM ---
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
        setLogs(l => [...l.slice(-8), `> SYNC_OK: ${new Date().toLocaleTimeString()}`]);
      } catch (e) { 
        setLogs(l => [...l.slice(-5), '> TELEMETRY_LINK_LOST: RETRYING...']);
      }
    };

    const loader = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(loader);
          setTimeout(() => setIsReady(true), 200);
          return 100;
        }
        return prev + 5;
      });
    }, 40);

    const dataInterval = setInterval(fetchStats, 10000);
    const animInterval = setInterval(() => setScanPos(p => (p + 1) % 100), 60);
    fetchStats();
    return () => { clearInterval(loader); clearInterval(dataInterval); clearInterval(animInterval); };
  }, []);

  const StatCard = ({ label, value, unit, color, subValue, historyKey }) => {
    const chartData = history.map(h => h[historyKey] || 0);
    return (
      <div style={{ 
        flex: '1 1 240px', margin: '10px', padding: '20px', 
        background: CYBER.card, border: `1px solid ${color}33`, borderRadius: '4px',
        position: 'relative', overflow: 'hidden', boxShadow: `inset 0 0 15px ${color}05`
      }}>
        <div style={{ color: '#8b949e', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px', fontWeight: 'bold' }}>{label}</div>
        <div style={{ color: '#fff', fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', fontFamily: 'monospace' }}>
          {value}<span style={{ fontSize: '14px', color: color, marginLeft: '6px' }}>{unit}</span>
        </div>
        <MiniChart data={chartData} color={color} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '10px', color: color, opacity: 0.8 }}>{subValue || 'SYSTEM_ACTIVE'}</span>
            <span style={{ fontSize: '9px', color: '#444' }}>LIVE_FEED</span>
        </div>
        <div style={{ width: '100%', height: '2px', background: '#000', marginTop: '8px' }}>
          <div style={{ width: `${Math.min(value > 100 ? 100 : value, 100)}%`, height: '100%', background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1s ease' }} />
        </div>
      </div>
    );
  };

  if (!isReady) {
    return (
      <div style={{ background: CYBER.bg, color: CYBER.primary, height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center', border: `1px solid ${CYBER.primary}33`, padding: '40px', background: CYBER.card }}>
          <div style={{ fontSize: '10px', letterSpacing: '5px', marginBottom: '20px' }}>NEURAL_PULSE_BOOTING...</div>
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
        /* 1. ГЛОБАЛЬНЫЙ ФОН ДЛЯ ВСЕХ ОКОН И МОДАЛОК */
        html, body, #adminjs, .adminjs_Box, [data-css="app-loader"], section, main { 
            background-color: ${CYBER.bg} !important; 
        }

        /* 2. НАВИГАЦИЯ (БОКОВАЯ ПАНЕЛЬ И ШАПКА) */
        [data-testid="sidebar"], 
        [data-testid="sidebar-header"],
        [data-testid="sidebar-content"],
        [data-testid="topbar"],
        .adminjs_Sidebar, .adminjs_Topbar, .adminjs_Logo {
            background-color: ${CYBER.bg} !important;
            background: ${CYBER.bg} !important;
            border-color: ${CYBER.border} !important;
        }

        /* 3. ТАБЛИЦЫ И СПИСКИ РЕСУРСОВ (Users, Tasks и т.д.) */
        .adminjs_Table, .adminjs_TableThead, .adminjs_TableTbody, .adminjs_TableRow, 
        [data-testid="table"], [data-testid="table-row"], td, th, tr {
            background-color: ${CYBER.card} !important;
            background: ${CYBER.card} !important;
            color: ${CYBER.text} !important;
            border-bottom: 1px solid ${CYBER.border} !important;
        }

        /* Заголовки таблиц */
        th, th *, [data-testid="table-cell-content"] {
            color: ${CYBER.primary} !important;
            background-color: ${CYBER.card} !important;
        }

        /* 4. ВЫПАДАЮЩИЕ СПИСКИ И ФИЛЬТРЫ (Fix для белых окон) */
        div[class*="DropDown"], div[class*="Select"], .adminjs_Select, 
        [data-testid="filter-drawer"], [data-testid="drawer"] {
            background-color: ${CYBER.card} !important;
            border: 1px solid ${CYBER.border} !important;
        }

        /* 5. КНОПКИ (Cyberpunk Style) */
        [data-testid="button-create"], [data-testid="filter-button"], .adminjs_Button {
            border: 1px solid ${CYBER.primary} !important;
            background: transparent !important;
            color: ${CYBER.primary} !important;
            text-transform: uppercase;
        }

        [data-testid="button-create"]:hover {
            box-shadow: 0 0 10px ${CYBER.primary} !important;
        }

        /* 6. ТЕКСТ */
        [data-testid="sidebar-resource-link"], span, a, p, h1, h2, h3, label {
            color: #c9d1d9 !important;
        }

        /* 7. УДАЛЕНИЕ ФУТЕРА */
        footer, [data-testid="footer"], .adminjs_Footer { 
            display: none !important; 
        }

        @keyframes cyber-pulse {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50% { transform: scaleY(1.2); opacity: 1; }
        }
      `}</style>

      {/* --- HUD HEADER --- */}
      <div style={{ background: CYBER.card, padding: '25px', borderRadius: '4px', border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '1px', height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.3, zIndex: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
          <div>
            <span style={{ padding: '2px 8px', background: CYBER.primary, color: '#000', fontWeight: 'bold', fontSize: '10px' }}>NEURAL_PULSE_OS_V3</span>
            <h2 style={{ color: CYBER.primary, margin: '10px 0 0 0', fontSize: '24px', letterSpacing: '1px' }}>CORE_TELEMETRY</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: CYBER.ton, fontWeight: 'bold', fontSize: '20px' }}>{stats.totalTon} TON</div>
            <div style={{ color: '#444', fontSize: '9px' }}>TOTAL_RESERVE</div>
          </div>
        </div>
      </div>

      {/* --- GRID --- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0 -10px' }}>
        <StatCard label="TOTAL_AGENTS" value={stats.totalUsers} unit="U" color={CYBER.primary} historyKey="user_count" />
        <StatCard label="NEW_PLAYERS" value={stats.dailyUsers} unit="+" color={CYBER.success} historyKey="user_count" />
        <StatCard label="WALLETS" value={stats.walletsLinked} unit="W" color={CYBER.ton} historyKey="active_wallets" />
        <StatCard label="CORE_LOAD" value={Number(stats.cpu).toFixed(1)} unit="%" color={CYBER.secondary} historyKey="server_load" />
        <StatCard label="MEM_USAGE" value={Math.round(stats.mem)} unit="MB" color={CYBER.warning} historyKey="mem_usage" />
        <StatCard label="LATENCY" value={stats.latency} unit="MS" color={CYBER.danger} historyKey="db_latency" />
      </div>

      {/* --- LOWER PANELS --- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '20px', gap: '20px' }}>
        <div style={{ flex: '2 1 400px', background: CYBER.card, height: '250px', border: `1px solid ${CYBER.border}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '15px', left: '15px', color: CYBER.primary, fontSize: '10px', opacity: 0.5 }}>WAVEFORM_MONITOR</div>
          {[...Array(30)].map((_, i) => (
            <div key={i} style={{ width: '6px', background: CYBER.primary, height: '30%', animation: `cyber-pulse 1.5s infinite ${i * 0.05}s` }} />
          ))}
        </div>

        <div style={{ flex: '1 1 300px', background: '#05070a', height: '250px', border: `1px solid ${CYBER.border}`, padding: '20px', overflow: 'hidden' }}>
          <div style={{ color: CYBER.success, fontSize: '10px', marginBottom: '10px' }}>SYSTEM_LOGS</div>
          <div style={{ fontSize: '10px', lineHeight: '1.6', color: '#4e555d' }}>
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
