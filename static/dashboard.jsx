import React, { useState, useEffect } from 'react'

// Извлекаем компоненты из глобального объекта AdminJSDesignSystem, 
// так как прямые импорты из модулей часто ломаются при бандлинге в браузере.
const { Box, H2, H5, Text, Card, Badge, Button } = window.AdminJSDesignSystem || {}

const CYBER = {
  bg: '#0b0e14',
  card: '#161b22',
  primary: '#00f2fe',
  secondary: '#7000ff',
  success: '#39ff14',
  warning: '#fbc02d',
  danger: '#ff3131',
  text: '#ffffff'
};

const Dashboard = (props) => {
  // Инициализация стейтов. Если данные не пришли из props.data, ставим дефолтные значения.
  const [stats, setStats] = useState(props.data || { totalUsers: 0, cpu: 0, currentMem: 0, dbLatency: 5 })
  const [scanPos, setScanPos] = useState(0)
  const [logs, setLogs] = useState(['> SYSTEM_READY', '> TELEMETRY_LINK_ESTABLISHED'])

  const addLog = (msg) => {
    setLogs(prev => [`> [${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 14))
  }

  const fetchStats = async () => {
    try {
      // Используем глобальный ApiClient для получения свежих данных из dashboard.handler в server.js
      const api = new window.AdminJS.ApiClient()
      const response = await api.getDashboard()
      const d = response.data || {}
      setStats(prev => ({ ...prev, ...d }))
      
      if (d.cpu > 80) addLog('CRITICAL: HIGH_CPU_LOAD');
      // Порог памяти адаптирован под лимиты твоего тарифа (159MB)
      if (d.currentMem > 140) addLog('MEMORY_SHIELD: ACTIVE'); 
    } catch (e) { 
      // Ошибка обычно означает временную потерю связи с сервером
    }
  }

  const handleReboot = () => {
    addLog('INITIATING_CORE_REBOOT...')
    setTimeout(() => addLog('FLUSHING_VIRTUAL_MEMORY...'), 1000)
    setTimeout(() => {
        addLog('SYSTEM_STABLE_V12.3');
        fetchStats();
    }, 2500)
  }

  useEffect(() => {
    const interval = setInterval(fetchStats, 5000)
    const anim = setInterval(() => setScanPos(p => (p + 1.2) % 100), 50)
    return () => { 
      clearInterval(interval)
      clearInterval(anim)
    }
  }, [])

  // Если дизайн-система еще не загрузилась, показываем индикатор загрузки
  if (!Box) return (
    <div style={{
      backgroundColor: '#0b0e14', 
      color: '#00f2fe', 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'monospace'
    }}>
      BOOTING_NEURAL_PULSE_OS...
    </div>
  )

  return (
    <Box padding="xl" style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace' }}>
      
      {/* HEADER SECTION С АНИМИРОВАННОЙ ЛИНИЕЙ СКАНИРОВАНИЯ */}
      <Box padding="xl" marginBottom="xl" borderRadius="xl" 
           style={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden' }}>
        <Box style={{ 
            position: 'absolute', top: 0, left: `${scanPos}%`, 
            width: '2px', height: '100%', 
            background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.6 
        }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Badge style={{ background: CYBER.success, color: '#000', fontWeight: '900' }}>NEURAL_PULSE_OS</Badge>
            <H2 style={{ color: CYBER.primary, marginTop: '10px', letterSpacing: '3px' }}>ADMIN_HUD_V12.3</H2>
          </Box>
          <Button variant="danger" size="sm" onClick={handleReboot}>SYSTEM_RELOAD</Button>
        </Box>
      </Box>

      {/* КАРТОЧКИ ТЕЛЕМЕТРИИ */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" margin="-sm">
        {[
          { label: 'ACTIVE_AGENTS', val: stats.totalUsers, color: CYBER.primary, unit: '' },
          { label: 'CPU_LOAD', val: stats.cpu, color: CYBER.success, unit: '%' },
          { label: 'MEM_USAGE', val: stats.currentMem, color: CYBER.secondary, unit: 'MB' },
          { label: 'DB_LATENCY', val: stats.dbLatency || 5, color: CYBER.warning, unit: 'ms' }
        ].map((item, i) => (
          <Box key={i} width={[1, 1/2, 1/4]} padding="sm">
            <Card style={{ backgroundColor: CYBER.card, border: `1px solid ${item.color}33` }}>
              <Box p="md">
                <Text size="xs" style={{ color: '#8b949e', fontWeight: 'bold' }}>{item.label}</Text>
                <H2 style={{ color: '#fff', margin: '8px 0' }}>
                  {item.val || 0}
                  <span style={{fontSize: '14px', color: item.color, marginLeft: '4px'}}>{item.unit}</span>
                </H2>
                <Box width="100%" height="3px" bg="#000">
                  <Box width={`${Math.min(item.val, 100)}%`} height="100%" 
                       style={{ background: item.color, boxShadow: `0 0 8px ${item.color}`, transition: 'width 1s ease-in-out' }} />
                </Box>
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        
        {/* ВИЗУАЛИЗАЦИЯ ПУЛЬСА ЯДРА */}
        <Box width={[1, 2/3]} paddingRight={['0', 'md']} marginBottom="xl">
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '420px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <H5 mb="xl" style={{ color: CYBER.primary }}>CORE_STABILITY_MONITOR</H5>
            
            <Box style={{ width: '80%', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                {[...Array(20)].map((_, i) => (
                    <Box key={i} style={{
                        width: '8px',
                        background: stats.cpu > 75 ? CYBER.danger : CYBER.primary,
                        height: `${20 + Math.random() * 60}%`,
                        borderRadius: '4px',
                        animation: `pulse-bars 1.5s infinite ease-in-out ${i * 0.1}s`,
                        boxShadow: `0 0 10px ${CYBER.primary}44`
                    }} />
                ))}
            </Box>
            <style>{`
                @keyframes pulse-bars {
                    0%, 100% { height: 30%; opacity: 0.4; }
                    50% { height: 80%; opacity: 1; }
                }
            `}</style>
            <Text mt="xl" color="#8b949e">STATUS: DATA_FLOW_STABLE</Text>
          </Box>
        </Box>

        {/* ТЕРМИНАЛ ЛОГОВ (ТЕМНЫЙ РЕЖИМ) */}
        <Box width={[1, 1/3]} paddingLeft={['0', 'md']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: '#000', height: '420px', border: `1px solid ${CYBER.success}44`, overflow: 'hidden' }}>
            <H5 mb="md" style={{ color: CYBER.success }}>TERMINAL_STREAM</H5>
            <Box>
                {logs.map((log, i) => (
                <Text key={i} size="xs" mb="xs" style={{ 
                  color: i === 0 ? CYBER.success : '#484f58',
                  whiteSpace: 'nowrap',
                  textShadow: i === 0 ? `0 0 5px ${CYBER.success}` : 'none'
                }}>{log}</Text>
                ))}
            </Box>
          </Box>
        </Box>

      </Box>
    </Box>
  )
}

export default Dashboard;
