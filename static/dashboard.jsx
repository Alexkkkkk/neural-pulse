import React, { useState, useEffect } from 'react'
import { Box, H2, H5, Text, Card, Badge, Button } from '@adminjs/design-system'
import { ApiClient } from 'adminjs'
import * as Recharts from 'recharts'

const { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area, Legend 
} = Recharts

const api = new ApiClient()

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
  const [stats, setStats] = useState(props.data || { totalUsers: 0, cpu: 0, currentMem: 0, dbLatency: 5 })
  const [history, setHistory] = useState(props.data?.history || [])
  const [scanPos, setScanPos] = useState(0)
  const [logs, setLogs] = useState(['> SYSTEM_READY', '> TELEMETRY_LINK_ESTABLISHED'])

  const addLog = (msg) => {
    setLogs(prev => [`> [${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 14))
  }

  const fetchStats = async () => {
    try {
      const response = await api.getDashboard()
      const d = response.data || {}
      setStats(d)
      
      // Гарантируем, что history — это массив
      if (d.history && Array.isArray(d.history)) {
        setHistory([...d.history])
      }

      if (d.cpu > 70) addLog('WARNING: HIGH_CPU_DETECTED');
      if (d.currentMem > 450) addLog('OPTIMIZING: MEMORY_CLEANUP_REQUIRED');
    } catch (e) { 
      addLog('TELEMETRY_LINK_LOST...')
    }
  }

  const handleReboot = () => {
    addLog('INITIATING_CORE_REBOOT...')
    setTimeout(() => addLog('FLUSHING_VIRTUAL_MEMORY...'), 1000)
    setTimeout(() => addLog('RE-SYNCHRONIZING_NODES...'), 2500)
    setTimeout(() => {
        addLog('SYSTEM_STABLE_V6.0.0');
        fetchStats();
    }, 4000)
  }

  useEffect(() => {
    const interval = setInterval(fetchStats, 5000)
    const anim = setInterval(() => setScanPos(p => (p + 1.2) % 100), 50)
    return () => { 
      clearInterval(interval)
      clearInterval(anim)
    }
  }, [])

  return (
    <Box padding="xl" style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace' }}>
      
      {/* HEADER */}
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
            <H2 style={{ color: CYBER.primary, marginTop: '10px', letterSpacing: '4px' }}>ADMIN_HUD_V6.0</H2>
          </Box>
          <Button variant="danger" size="sm" onClick={handleReboot}>SYSTEM_RELOAD</Button>
        </Box>
      </Box>

      {/* STATS */}
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
                <H2 style={{ color: '#fff', margin: '8px 0' }}>{item.val || 0}<span style={{fontSize: '14px', color: item.color}}>{item.unit}</span></H2>
                <Box width="100%" height="3px" bg="#000">
                  <Box width={`${Math.min(item.val, 100)}%`} height="100%" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
                </Box>
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        {/* GRAPH */}
        <Box width={[1, 2/3]} paddingRight={['0', 'md']} marginBottom="xl">
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '420px', border: '1px solid #30363d' }}>
            <H5 mb="xl" style={{ color: CYBER.primary }}>REALTIME_SYSTEM_TELEMETRY</H5>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CYBER.primary} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={CYBER.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                <XAxis dataKey="time" stroke="#8b949e" />
                <YAxis stroke="#8b949e" />
                <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: `1px solid ${CYBER.primary}`, color: '#fff' }} />
                <Legend />
                {/* Используем яркие цвета и выключаем анимацию для стабильности */}
                <Area name="CPU (%)" type="monotone" dataKey="cpu" stroke={CYBER.primary} fill="url(#colorCpu)" strokeWidth={3} isAnimationActive={false} />
                <Area name="RAM (MB)" type="monotone" dataKey="mem" stroke={CYBER.secondary} fill="transparent" strokeWidth={3} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* LOGS */}
        <Box width={[1, 1/3]} paddingLeft={['0', 'md']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: '#000', height: '420px', border: `1px solid ${CYBER.success}44` }}>
            <H5 mb="md" style={{ color: CYBER.success }}>TERMINAL_STREAM</H5>
            <Box>
                {logs.map((log, i) => (
                <Text key={i} size="xs" mb="xs" style={{ color: i === 0 ? CYBER.success : '#484f58' }}>{log}</Text>
                ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default Dashboard;
