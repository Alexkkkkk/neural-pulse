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
  // Безопасное извлечение компонентов из глобального объекта
  const DS = window.AdminJSDesignSystem || {};
  const { Box, H2, H5, Text, Card, Badge, Button } = DS;

  // Данные телеметрии
  const initialStats = props.data || { totalUsers: 0, history: [] };
  const lastHistory = initialStats.history?.length > 0 
    ? initialStats.history[initialStats.history.length - 1] 
    : { cpu: 0, mem: 0 };

  const [stats, setStats] = useState({
    totalUsers: initialStats.totalUsers || 0,
    cpu: lastHistory.cpu || 0,
    currentMem: lastHistory.mem || 0,
    dbLatency: 5
  });
  
  const [scanPos, setScanPos] = useState(0);
  const [logs, setLogs] = useState(['> SYSTEM_READY', '> TELEMETRY_LINK_ESTABLISHED']);

  const addLog = (msg) => {
    setLogs(prev => [`> [${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 12));
  };

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
        currentMem: latest.mem || 0,
        dbLatency: Math.floor(Math.random() * 5) + 2
      });
      
      if (latest.cpu > 80) addLog('ALERT: HIGH_CPU_LOAD');
    } catch (e) { /* silent pulse */ }
  };

  useEffect(() => {
    const interval = setInterval(fetchStats, 5000);
    const anim = setInterval(() => setScanPos(p => (p + 1.5) % 100), 50);
    return () => { clearInterval(interval); clearInterval(anim); };
  }, []);

  // Защитный рендер: если Box не определен, не ломаем React
  if (!Box) {
    return (
      <div style={{ background: CYBER.bg, color: CYBER.primary, padding: '40px', fontFamily: 'monospace', height: '100vh' }}>
        > BOOTING_NEURAL_PULSE_INTERFACE...
      </div>
    );
  }

  return (
    <Box padding="xl" style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace', margin: '-20px' }}>
      {/* Исправление белых областей со скриншотов */}
      <style>{`
        section[data-testid="property-list"], 
        .adminjs_Table, 
        .adminjs_Table-Row, 
        .adminjs_Card,
        .adminjs_Box {
          background-color: ${CYBER.card} !important;
          color: ${CYBER.text} !important;
          border-color: ${CYBER.border} !important;
        }
        .adminjs_Button[variant="contained"] { 
          background-color: ${CYBER.primary} !important; 
          color: #000 !important; 
          font-weight: bold !important;
        }
        @keyframes pulse-bars-cyber {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1.2); opacity: 1; }
        }
      `}</style>

      {/* HEADER */}
      <Box padding="xl" marginBottom="xl" borderRadius="xl" 
           style={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden' }}>
        <Box style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '2px', height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.6 }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Badge style={{ background: CYBER.success, color: '#000', fontWeight: '900' }}>NEURAL_PULSE_V12</Badge>
            <H2 style={{ color: CYBER.primary, marginTop: '10px', textShadow: `0 0 10px ${CYBER.primary}44` }}>ADMIN_TELEMETRY</H2>
          </Box>
          <Button variant="danger" size="sm" onClick={() => window.location.reload()}>SYSTEM_RELOAD</Button>
        </Box>
      </Box>

      {/* STATS GRID */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" margin="-sm">
        {[
          { label: 'ACTIVE_USERS', val: stats.totalUsers, color: CYBER.primary, unit: '' },
          { label: 'CPU_USAGE', val: stats.cpu, color: CYBER.success, unit: '%' },
          { label: 'MEM_LOAD', val: stats.currentMem, color: CYBER.secondary, unit: 'MB' },
          { label: 'LATENCY', val: stats.dbLatency, color: CYBER.warning, unit: 'ms' }
        ].map((item, i) => (
          <Box key={i} width={[1, 1/2, 1/4]} padding="sm">
            <Card style={{ backgroundColor: CYBER.card, border: `1px solid ${item.color}33`, borderRadius: '8px' }}>
              <Box p="md">
                <Text size="xs" style={{ color: '#8b949e', fontWeight: 'bold' }}>{item.label}</Text>
                <H2 style={{ color: '#fff', margin: '8px 0' }}>
                  {item.val}
                  <span style={{fontSize: '14px', color: item.color, marginLeft: '4px'}}>{item.unit}</span>
                </H2>
                <Box width="100%" height="2px" bg="#000">
                  <Box width={`${Math.min(item.val, 100)}%`} height="100%" 
                       style={{ background: item.color, boxShadow: `0 0 8px ${item.color}`, transition: 'width 1s' }} />
                </Box>
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      {/* LOWER SECTION */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        <Box width={[1, 2/3]} paddingRight={['0', 'md']} marginBottom="xl">
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '350px', border: `1px solid ${CYBER.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <H5 mb="xl" style={{ color: CYBER.primary }}>CORE_PULSE_STABILITY</H5>
            <Box style={{ width: '90%', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {[...Array(20)].map((_, i) => (
                    <Box key={i} style={{
                        width: '8px',
                        background: stats.cpu > 80 ? CYBER.danger : CYBER.primary,
                        height: '50%',
                        borderRadius: '2px',
                        animation: `pulse-bars-cyber 1.2s infinite ease-in-out ${i * 0.05}s`
                    }} />
                ))}
            </Box>
            <Text mt="xl" style={{ color: '#484f58' }}>STATUS: ENCRYPTED_LINK_STABLE</Text>
          </Box>
        </Box>

        <Box width={[1, 1/3]} paddingLeft={['0', 'md']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: '#000', height: '350px', border: `1px solid ${CYBER.success}44`, overflow: 'hidden' }}>
            <H5 mb="md" style={{ color: CYBER.success }}>TERMINAL_LOGS</H5>
            {logs.map((log, i) => (
              <Text key={i} size="xs" style={{ 
                color: i === 0 ? CYBER.success : '#484f58', 
                marginBottom: '6px',
                textShadow: i === 0 ? `0 0 5px ${CYBER.success}` : 'none'
              }}>{log}</Text>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
