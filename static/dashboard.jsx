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
  // 1. Безопасное извлечение с проверкой на существование
  const DS = window.AdminJSDesignSystem || {};
  const { Box, H2, H5, Text, Card, Badge, Button } = DS;

  const [stats, setStats] = useState({
    totalUsers: props.data?.totalUsers || 0,
    cpu: 0,
    mem: 0,
    latency: 5
  });
  
  const [scanPos, setScanPos] = useState(0);
  const [logs, setLogs] = useState(['> SYSTEM_READY', '> NEURAL_PULSE_ENCRYPTION_ACTIVE']);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Проверка готовности API клиента
        if (!window.AdminJS || !window.AdminJS.ApiClient) return;
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
      } catch (e) { /* silent pulse */ }
    };

    const interval = setInterval(fetchStats, 5000);
    const anim = setInterval(() => setScanPos(p => (p + 1.5) % 100), 50);
    return () => { clearInterval(interval); clearInterval(anim); };
  }, []);

  // 2. АВАРИЙНЫЙ ВЫХОД: Если дизайн-система не загрузилась, рендерим чистый HTML
  // Это предотвращает "Element type is invalid"
  if (!Box || !Card || !H2 || !Text || !Button) {
    return (
      <div style={{ 
        background: CYBER.bg, color: CYBER.primary, padding: '50px', 
        height: '100vh', fontFamily: 'monospace', fontSize: '18px' 
      }}>
        > BOOTING_NEURAL_PULSE_HUD...
        <br/>
        > LOADING_DEPENDENCIES...
      </div>
    );
  }

  return (
    <Box padding="xl" style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace', margin: '-20px' }}>
      
      {/* 3. ГЛОБАЛЬНАЯ ИНЪЕКЦИЯ СТИЛЕЙ ДЛЯ ТЕМНОЙ ТЕМЫ */}
      <style>{`
        /* Фон всей админки */
        #adminjs, .adminjs_Box, body { background-color: ${CYBER.bg} !important; }

        /* Перекрашиваем все таблицы, списки и карточки AdminJS */
        .adminjs_Table, .adminjs_Table-Row, .adminjs_Table-Head, 
        .adminjs_Card, section[data-testid="property-list"],
        div[data-testid="drawer-content"] {
          background-color: ${CYBER.card} !important;
          color: ${CYBER.text} !important;
          border-color: ${CYBER.border} !important;
        }

        /* Исправляем цвет в кнопках и навигации */
        .adminjs_Button[variant="contained"] {
          background-color: ${CYBER.primary} !important;
          color: #000 !important;
          border: none !important;
        }
        
        /* Убираем стандартный заголовок дашборда */
        section[data-testid="dashboard"] > h1 { display: none; }

        @keyframes pulse-bars-cyber {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1.2); opacity: 1; }
        }
      `}</style>

      {/* HEADER */}
      <Box padding="xl" marginBottom="xl" borderRadius="lg" 
           style={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden' }}>
        <Box style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '2px', height: '100%', background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.5 }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Badge style={{ background: CYBER.success, color: '#000', fontWeight: 'bold' }}>SYSTEM_OS_V12.3</Badge>
            <H2 style={{ color: CYBER.primary, marginTop: '10px', textShadow: `0 0 10px ${CYBER.primary}44` }}>CORE_TELEMETRY</H2>
          </Box>
          <Button variant="danger" size="sm" onClick={() => window.location.reload()} style={{fontWeight: 'bold'}}>RELOAD_INTERFACE</Button>
        </Box>
      </Box>

      {/* STATS GRID */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" margin="-sm">
        {[
          { label: 'ACTIVE_AGENTS', val: stats.totalUsers, color: CYBER.primary, unit: '' },
          { label: 'CPU_POWER', val: stats.cpu, color: CYBER.success, unit: '%' },
          { label: 'MEM_BUFFER', val: stats.mem, color: CYBER.secondary, unit: 'MB' },
          { label: 'NET_LATENCY', val: stats.latency, color: CYBER.warning, unit: 'ms' }
        ].map((item, i) => (
          <Box key={i} width={[1, 1/2, 1/4]} padding="sm">
            <Card style={{ backgroundColor: CYBER.card, border: `1px solid ${item.color}33`, borderRadius: '4px' }}>
              <Box p="lg">
                <Text size="xs" style={{ color: '#8b949e', letterSpacing: '1px' }}>{item.label}</Text>
                <H2 style={{ color: '#fff', margin: '10px 0' }}>
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

      {/* LOWER PANELS */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        <Box width={[1, 2/3]} paddingRight={['0', 'lg']} marginBottom="xl">
          <Box padding="xl" borderRadius="lg" style={{ backgroundColor: CYBER.card, height: '350px', border: `1px solid ${CYBER.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', position: 'relative' }}>
            <Text style={{position: 'absolute', top: '20px', left: '20px', color: CYBER.primary, fontSize: '12px'}}>PULSE_STABILITY_MONITOR</Text>
            {[...Array(20)].map((_, i) => (
              <Box key={i} style={{
                width: '10px',
                background: stats.cpu > 80 ? CYBER.danger : CYBER.primary,
                height: '40%',
                borderRadius: '1px',
                animation: `pulse-bars-cyber 1.2s infinite ease-in-out ${i * 0.05}s`
              }} />
            ))}
          </Box>
        </Box>

        <Box width={[1, 1/3]}>
          <Box padding="lg" borderRadius="lg" style={{ backgroundColor: '#000', height: '350px', border: `1px solid ${CYBER.success}44`, overflow: 'hidden' }}>
            <H5 mb="md" style={{ color: CYBER.success, letterSpacing: '2px' }}>TERMINAL_STREAM</H5>
            <Box>
                {logs.concat(['> STATUS_OK', '> DATA_LINK_STABLE']).map((log, i) => (
                <Text key={i} size="xs" style={{ color: i === 0 ? CYBER.success : '#30363d', marginBottom: '6px' }}>{log}</Text>
                ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
