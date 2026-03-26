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
  // Состояния для телеметрии и логов
  const [stats, setStats] = useState(props.data || { totalUsers: 0, cpu: 0, currentMem: 0, dbLatency: 0 })
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
      
      // Добавляем точку на график только если есть данные
      const cpuVal = parseFloat(d.cpu || 0)
      const memVal = parseFloat(d.currentMem || 0)

      setHistory(prev => {
        const newPoint = {
          time: new Date().toLocaleTimeString().slice(0, 5),
          cpu: cpuVal,
          ram: memVal,
        };
        // Держим последние 20 записей для плавности
        return [...prev, newPoint].slice(-20)
      })
    } catch (e) { 
      console.error('Pulse Telemetry Error:', e)
      addLog('КРИТИЧЕСКАЯ ОШИБКА СЕТИ')
    }
  }

  useEffect(() => {
    // Опрос API раз в 5 секунд
    const interval = setInterval(fetchStats, 5000)
    // Эффект "бегущего луча" сканера
    const anim = setInterval(() => setScanPos(p => (p + 1.5) % 100), 60)
    
    return () => { 
      clearInterval(interval)
      clearInterval(anim)
    }
  }, [])

  return (
    <Box padding="xl" style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: '"Courier New", monospace' }}>
      
      {/* HEADER: СТАТУС СИСТЕМЫ */}
      <Box padding="xl" marginBottom="xl" borderRadius="xl" 
           style={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden' }}>
        <Box style={{ 
            position: 'absolute', top: 0, left: `${scanPos}%`, 
            width: '3px', height: '100%', 
            background: `linear-gradient(to bottom, transparent, ${CYBER.primary}, transparent)`, 
            boxShadow: `0 0 20px ${CYBER.primary}`, opacity: 0.5 
        }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Badge variant="success" style={{ background: CYBER.success, color: '#000', fontWeight: 'bold' }}>SYSTEM_STABLE</Badge>
            <H2 style={{ color: CYBER.primary, marginTop: '10px', letterSpacing: '3px', fontWeight: '900' }}>NEURAL PULSE // HUD</H2>
          </Box>
          <Box display="flex" gap="md">
            <Button variant="danger" size="sm" onClick={() => addLog('CORE REBOOT REQUESTED')}>FORCE_REBOOT</Button>
          </Box>
        </Box>
      </Box>

      {/* STATS CARDS: ГРИД ПОКАЗАТЕЛЕЙ */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" margin="-sm">
        {[
          { label: 'ACTIVE_AGENTS', val: stats.totalUsers, color: CYBER.primary, unit: '' },
          { label: 'CPU_UTILIZATION', val: stats.cpu, color: CYBER.success, unit: '%' },
          { label: 'MEMORY_ALLOCATED', val: stats.currentMem, color: CYBER.secondary, unit: ' MB' },
          { label: 'DATABASE_LATENCY', val: stats.dbLatency, color: CYBER.warning, unit: ' ms' }
        ].map((item, i) => (
          <Box key={i} width={[1, 1/2, 1/4]} padding="sm">
            <Card style={{ backgroundColor: CYBER.card, border: `1px solid ${item.color}33`, borderRadius: '12px' }}>
              <Box p="md">
                <Text size="xs" color="grey60" style={{ letterSpacing: '1px', fontWeight: 'bold' }}>{item.label}</Text>
                <H2 style={{ color: '#fff', margin: '10px 0', fontSize: '28px' }}>{item.val || 0}{item.unit}</H2>
                <Box width="100%" height="2px" bg="#000" mt="md">
                    <Box width={`${Math.min(parseFloat(item.val) || 0, 100)}%`} 
                         height="100%" 
                         style={{ background: item.color, boxShadow: `0 0 10px ${item.color}`, transition: 'width 1s ease' }} />
                </Box>
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        {/* ГРАФИК ТЕЛЕМЕТРИИ */}
        <Box width={[1, 2/3]} paddingRight={['0', 'sm']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '400px', border: '1px solid #1a222d' }}>
            <H5 mb="xl" style={{ color: CYBER.primary, letterSpacing: '1px' }}>OS_PULSE_MONITOR</H5>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="2 2" stroke="#1f242c" vertical={false} />
                <XAxis dataKey="time" stroke="#484f58" tick={{ fontSize: 10 }} />
                <YAxis stroke="#484f58" tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}`, borderRadius: '8px' }}
                  itemStyle={{ color: CYBER.primary }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke={CYBER.primary} 
                  fill={CYBER.primary} 
                  fillOpacity={0.05} 
                  strokeWidth={3}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* ЖИВОЙ ТЕРМИНАЛ ЛОГОВ */}
        <Box width={[1, 1/3]} paddingLeft={['0', 'sm']}>
          <Box padding="lg" borderRadius="xl" 
               style={{ 
                 backgroundColor: '#000', 
                 height: '400px', 
                 border: `1px solid ${CYBER.success}22`, 
                 position: 'relative',
                 boxShadow: `inset 0 0 15px #000`
               }}>
            <H5 mb="md" style={{ color: CYBER.success }}>TERMINAL_OUTPUT</H5>
            <Box style={{ overflowY: 'hidden' }}>
              {logs.map((log, i) => (
                <Text key={i} 
                      size="xs" 
                      mb="xs" 
                      style={{ 
                        color: i === 0 ? CYBER.success : '#484f58',
                        fontFamily: 'monospace',
                        textShadow: i === 0 ? `0 0 8px ${CYBER.success}66` : 'none',
                        opacity: 1 - (i * 0.1) 
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
