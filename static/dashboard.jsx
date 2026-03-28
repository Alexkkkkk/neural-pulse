import React, { useState, useEffect } from 'react'

const CYBER = {
  bg: '#0b0e14',
  card: '#161b22',
  primary: '#00f2fe',
  secondary: '#7000ff',
  success: '#39ff14',
  warning: '#fbc02d',
  danger: '#ff3131',
  text: '#ffffff',
  border: '#30363d'
};

const Dashboard = (props) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [forceMode, setForceMode] = useState(false);
  const [logs, setLogs] = useState(['> INITIALIZING_BOOT_SEQUENCE...']);
  const [stats, setStats] = useState({
    totalUsers: props.data?.totalUsers || 0,
    cpu: 0,
    mem: 0,
    latency: 5
  });
  
  const [scanPos, setScanPos] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    
    // 1. КОНТРОЛЛЕР ЗАГРУЗКИ
    const loader = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const dsLoaded = !!(window.AdminJSDesignSystem && window.AdminJSDesignSystem.Box);

      setLoadingProgress(prev => {
        if (dsLoaded) {
          if (prev >= 100) {
            clearInterval(loader);
            setIsReady(true);
            return 100;
          }
          if (prev === 40) setLogs(l => [...l, '> ASSETS_LOADED_SUCCESSFULLY']);
          if (prev === 80) setLogs(l => [...l, '> CORE_SYSTEMS_LINKED']);
          return prev + 15; // Ускоренная загрузка при наличии системы
        }
        
        if (elapsed > 5000) {
          clearInterval(loader);
          setForceMode(true);
          setLogs(l => [...l, '> ERROR: DS_TIMEOUT', '> STARTING_IN_STANDALONE_MODE']);
          setTimeout(() => setIsReady(true), 500);
          return 100;
        }

        if (prev === 30 && logs.length === 1) setLogs(l => [...l, '> SEARCHING_FOR_RESOURCES...']);
        return prev < 95 ? prev + 1 : prev;
      });
    }, 100);

    // 2. ОБНОВЛЕНИЕ ТЕЛЕМЕТРИИ
    const fetchStats = async () => {
      try {
        if (!window.AdminJS?.ApiClient) return;
        const api = new window.AdminJS.ApiClient();
        const response = await api.getDashboard();
        const d = response.data || {};
        const latest = d.history?.[d.history.length - 1] || { cpu: 0, mem: 0 };

        setStats({
          totalUsers: d.totalUsers || 0,
          cpu: latest.cpu || 0,
          mem: latest.mem || 0,
          latency: Math.floor(Math.random() * 5) + 2
        });
      } catch (e) { 
        setLogs(l => [...l.slice(-5), '> API_REFRESH_FAILED']);
      }
    };

    const interval = setInterval(fetchStats, 5000);
    const anim = setInterval(() => setScanPos(p => (p + 1.2) % 100), 50);
    
    return () => { 
      clearInterval(loader); 
      clearInterval(interval); 
      clearInterval(anim); 
    };
  }, []);

  const StatCard = ({ label, value, unit, color }) => (
    <div style={{ 
      flex: '1 1 220px', margin: '10px', padding: '20px', 
      background: CYBER.card, border: `1px solid ${color}33`, borderRadius: '4px',
      boxShadow: `inset 0 0 15px ${color}08`
    }}>
      <div style={{ color: '#8b949e', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px', fontWeight: 'bold' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', fontFamily: 'monospace' }}>
        {value}
        <span style={{ fontSize: '14px', color: color, marginLeft: '6px' }}>{unit}</span>
      </div>
      <div style={{ width: '100%', height: '2px', background: '#000', marginTop: '15px' }}>
        <div style={{ 
          width: `${Math.min(value, 100)}%`, height: '100%', 
          background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 1.5s ease-in-out' 
        }} />
      </div>
    </div>
  );

  // ЭКРАН ЗАГРУЗКИ
  if (!isReady) {
    return (
      <div style={{ background: CYBER.bg, color: CYBER.primary, height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
        <div style={{ border: `1px solid ${CYBER.primary}33`, padding: '50px', textAlign: 'center', background: CYBER.card, position: 'relative' }}>
          <div style={{ fontSize: '12px', color: CYBER.primary, marginBottom: '25px', letterSpacing: '5px', opacity: 0.8 }}>SYSTEM_BOOTING</div>
          <div style={{ fontSize: '72px', fontWeight: 'bold', textShadow: `0 0 20px ${CYBER.primary}44` }}>{loadingProgress}%</div>
          <div style={{ width: '250px', height: '2px', background: '#080a0f', marginTop: '30px', position: 'relative', overflow: 'hidden' }}>
             <div style={{ width: `${loadingProgress}%`, height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, transition: 'width 0.2s' }} />
          </div>
          <div style={{ marginTop: '20px', height: '20px', fontSize: '10px', color: '#444' }}>
            {logs[logs.length - 1]}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace', padding: '20px', boxSizing: 'border-box' }}>
      <style>{`
        /* ПРИНУДИТЕЛЬНЫЙ ТЕМНЫЙ ФОН ДЛЯ ВСЕХ ЭЛЕМЕНТОВ ADMINJS */
        #adminjs, .adminjs_Box, body, html, [data-css="layout"], section[data-testid="dashboard"] { 
          background-color: ${CYBER.bg} !important; 
        }

        /* ПОЛНАЯ ПЕРЕКРАСКА САЙДБАРА */
        section[data-testid="sidebar"], div[data-css="sidebar"], aside {
          background-color: ${CYBER.card} !important;
          border-right: 1px solid ${CYBER.border} !important;
        }
        
        /* ПОДМЕНА ЛОГОТИПА ВЕРХУ СЛЕВА */
        section[data-testid="sidebar"] h1, section[data-testid="sidebar"] a[href*="admin"] > img {
          display: none !important;
        }
        section[data-testid="sidebar"] a[href*="admin"]:first-of-type::before {
          content: "";
          display: block;
          width: 150px;
          height: 60px;
          background: url('/static/images/logo.png') no-repeat center;
          background-size: contain;
          margin: 15px auto;
        }

        /* ТЕКСТ И ИКОНКИ В МЕНЮ */
        section[data-testid="sidebar"] a, section[data-testid="sidebar"] span, section[data-testid="sidebar"] svg {
          color: ${CYBER.text} !important;
        }

        /* ВЕРХНЯЯ ШАПКА АДМИНКИ */
        header[data-css="top-bar"], .adminjs_TopBar {
          background-color: ${CYBER.bg} !important;
          border-bottom: 1px solid ${CYBER.border} !important;
        }

        .adminjs_Table, .adminjs_Table-Row, .adminjs_Table-Head, .adminjs_Table-Cell, .adminjs_Table-Body,
        .adminjs_Card, section[data-testid="property-list"], div[data-testid="drawer-content"],
        .adminjs_TextArea, .adminjs_Input, .adminjs_Select {
          background-color: ${CYBER.card} !important;
          color: ${CYBER.text} !important;
          border-color: ${CYBER.border} !important;
        }

        section[data-testid="dashboard"] > h1 { display: none; }
        
        @keyframes cyber-pulse {
          0%, 100% { transform: scaleY(0.4); opacity: 0.4; }
          50% { transform: scaleY(1.3); opacity: 1; }
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* HEADER HUD */}
      <div style={{ background: CYBER.card, padding: '25px', borderRadius: '4px', border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '2px', height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.5 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ padding: '3px 10px', background: forceMode ? CYBER.warning : CYBER.success, color: '#000', fontWeight: 'bold', fontSize: '10px', letterSpacing: '1px' }}>
              {forceMode ? 'STANDALONE_V2' : 'CORE_SYNC_STABLE'}
            </span>
            <h2 style={{ color: CYBER.primary, margin: '12px 0 0 0', fontSize: '26px', textShadow: `0 0 10px ${CYBER.primary}44` }}>NEURAL_TELEMETRY_CORE</h2>
          </div>
          <button onClick={() => window.location.reload()} style={{ background: 'transparent', border: `1px solid ${CYBER.danger}`, color: CYBER.danger, padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', transition: '0.3s' }}>
            SYSTEM_REBOOT
          </button>
        </div>
      </div>

      {/* STATS GRID */}
      <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0 -10px' }}>
        <StatCard label="TOTAL_AGENTS_ONLINE" value={stats.totalUsers} unit="U" color={CYBER.primary} />
        <StatCard label="CORE_LOAD_STATUS" value={stats.cpu} unit="%" color={CYBER.success} />
        <StatCard label="MEMORY_SWAP_USAGE" value={stats.mem} unit="MB" color={CYBER.secondary} />
        <StatCard label="NET_SIGNAL_LATENCY" value={stats.latency} unit="MS" color={CYBER.warning} />
      </div>

      {/* VISUAL & TERMINAL */}
      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '20px', gap: '20px' }}>
        <div style={{ flex: '2 1 400px', background: CYBER.card, height: '320px', border: `1px solid ${CYBER.border}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '15px', left: '15px', color: CYBER.primary, fontSize: '10px', opacity: 0.6, letterSpacing: '2px' }}>LIVE_WAVEFORM_MONITOR</div>
          {[...Array(28)].map((_, i) => (
            <div key={i} style={{
              width: '10px', background: stats.cpu > 80 ? CYBER.danger : CYBER.primary, height: '35%', borderRadius: '1px',
              animation: `cyber-pulse 1.5s infinite ease-in-out ${i * 0.05}s`
            }} />
          ))}
        </div>

        <div style={{ flex: '1 1 250px', background: '#05070a', height: '320px', border: `1px solid ${CYBER.success}44`, padding: '25px', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ color: CYBER.success, fontSize: '12px', letterSpacing: '3px', marginBottom: '20px', borderBottom: `1px solid ${CYBER.success}22`, paddingBottom: '10px' }}>TERMINAL_OUTPUT</div>
          <div style={{ overflowY: 'hidden', height: '220px' }}>
            {logs.slice(-8).map((log, i) => (
              <div key={i} style={{ color: log.includes('ERROR') ? CYBER.danger : i === logs.length - 1 ? CYBER.success : '#2a2f35', fontSize: '11px', marginBottom: '10px', lineHeight: '1.4' }}>
                {log}
              </div>
            ))}
            <div style={{ color: CYBER.primary, fontSize: '11px', animation: 'pulse 1s infinite' }}>> SCANNING_NETWORK...</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
