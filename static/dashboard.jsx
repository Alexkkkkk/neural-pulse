import React, { useState, useEffect } from 'react'
import { Box, H2, H5, Text, Card, Badge, Button } from '@adminjs/design-system'
import { ApiClient } from 'adminjs'
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts'

const api = new ApiClient()

// Цветовая схема Neural Pulse (Cyberpunk Edition)
const CYBER = {
  bg: '#05070a',
  card: '#0d1117',
  primary: '#00f2fe',
  secondary: '#7000ff',
  success: '#39ff14',
  warning: '#fbc02d',
  danger: '#ff3131',
  text: '#e6edf3'
};

const Dashboard = (props) => {
  // Начальные данные из пропсов или пустые значения
  const [stats, setStats] = useState(props.data || {})
  const [history, setHistory] = useState([])
  const [scanPos, setScanPos] = useState(0)
  const [logs, setLogs] = useState(['> Инициализация ядра...', '> Подключение к TON Mainnet...'])

  const addLog = (msg) => {
    setLogs(prev => [`> [${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10))
  }

  const fetchStats = async () => {
    try {
      const response = await api.getDashboard()
      const d = response.data || {}
      setStats(d)
      
      // Обновляем историю для графика (храним последние 20 точек)
      if (d.cpu !== undefined) {
        setHistory(prev => [...prev, {
          time: new Date().toLocaleTimeString().slice(0, 5),
          cpu: parseFloat(d.cpu || 0),
          ram: parseFloat(d.currentMem || 0),
        }].slice(-20))
      }
    } catch (e) { 
      console.error('Pulse Error:', e)
      addLog('ОШИБКА ПОЛУЧЕНИЯ ТЕЛЕМЕТРИИ')
    }
  }

  useEffect(() => {
    // Опрос API каждые 5 секунд
    const interval = setInterval(fetchStats, 5000)
    // Анимация сканирующей линии (эффект терминала)
    const anim = setInterval(() => setScanPos(p => (p + 1) % 100), 50)
    
    return () => { 
      clearInterval(interval)
      clearInterval(anim)
    }
  }, [])

  return (
    <Box padding="xl" style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace' }}>
      
      {/* HEADER: КИБЕР-ТЕРМИНАЛ */}
      <Box padding="xl" marginBottom="xl" borderRadius="xl" 
           style={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden' }}>
        <Box style={{ 
            position: 'absolute', top: 0, left: `${scanPos}%`, 
            width: '2px', height: '100%', 
            background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.4 
        }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Badge style={{ background: CYBER.success, color: '#000', fontWeight: 'bold' }}>CORE_V1.2.0_ACTIVE</Badge>
            <H2 style={{ color: CYBER.primary, marginTop: '10px', letterSpacing: '2px' }}>NEURAL PULSE // TERMINAL</H2>
          </Box>
          <Box display="flex" gap="md">
            <Button variant="danger" size="sm" onClick={() => addLog('CORE REBOOT INITIATED')}>SYSTEM_REBOOT</Button>
          </Box>
        </Box>
      </Box>

      {/* STATS CARDS: ГЛАВНЫЕ ПОКАЗАТЕЛИ */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" margin="-sm">
        {[
          { label: 'AGENTS (USERS)', val: stats.totalUsers, color: CYBER.primary },
          { label: 'CPU LOAD', val: `${stats.cpu || 0}%`, color: CYBER.success },
          { label: 'RAM USAGE', val: `${stats.currentMem || 0}MB`, color: CYBER.secondary },
          { label: 'DB LATENCY', val: `${stats.dbLatency || 0}ms`, color: CYBER.warning }
        ].map((item, i) => (
          <Box key={i} width={[1, 1/2, 1/4]} padding="sm">
            <Card style={{ backgroundColor: CYBER.card, border: `1px solid ${item.color}33`, borderRadius: '16px' }}>
              <Box p="md">
                <Text size="xs" color="grey60" style={{ letterSpacing: '1px' }}>{item.label}</Text>
                <H2 style={{ color: '#fff', margin: '10px 0' }}>{item.val || 0}</H2>
                <Box width="100%" height="4px" bg="#000" mt="md" borderRadius="2px">
                    <Box width={`${Math.min(parseInt(item.val) || 10, 100)}%`} 
                         height="100%" 
                         style={{ background: item.color, boxShadow: `0 0 10px ${item.color}` }} />
                </Box>
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        {/* ЧАРТ: ТЕЛЕМЕТРИЯ В РЕАЛЬНОМ ВРЕМЕНИ */}
        <Box width={[1, 2/3]} paddingRight={['0', 'sm']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '400px', border: '1px solid #30363d' }}>
            <H5 mb="xl" style={{ color: CYBER.primary }}>SYSTEM_TELEMETRY_STREAM</H5>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f242c" />
                <XAxis dataKey="time" stroke="#484f58" tick={{ fontSize: 10 }} />
                <YAxis stroke="#484f58" tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}`, color: '#fff' }}
                  itemStyle={{ color: CYBER.primary }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke={CYBER.primary} 
                  fill={CYBER.primary} 
                  fillOpacity={0.1} 
                  animationDuration={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* ЛОГИ: ЖИВОЙ ПОТОК */}
        <Box width={[1, 1/3]} paddingLeft={['0', 'sm']}>
          <Box padding="lg" borderRadius="xl" 
               style={{ 
                 backgroundColor: '#000', 
                 height: '400px', 
                 border: `1px solid ${CYBER.success}33`, 
                 overflow: 'hidden',
                 boxShadow: `inset 0 0 20px ${CYBER.success}11`
               }}>
            <H5 mb="md" style={{ color: CYBER.success }}>LIVE_LOG_STREAM</H5>
            <Box>
              {logs.map((log, i) => (
                <Text key={i} 
                      color={i === 0 ? CYBER.success : 'grey60'} 
                      size="xs" 
                      mb="xs" 
                      style={{ 
                        whiteSpace: 'nowrap', 
                        textShadow: i === 0 ? `0 0 5px ${CYBER.success}` : 'none',
                        borderLeft: i === 0 ? `2px solid ${CYBER.success}` : 'none',
                        paddingLeft: '5px'
                      }}>
                  {log}
                </Text>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default Dashboard;
