import React, { useState, useEffect } from 'react'
import { Box, H2, H5, Text, Card, Badge, Button } from '@adminjs/design-system'
import { ApiClient } from 'adminjs'
import * as Recharts from 'recharts'

const { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} = Recharts

const api = new ApiClient()

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
  const [stats, setStats] = useState(props.data || { totalUsers: 0, cpu: 0, currentMem: 0, dbLatency: 0 })
  const [history, setHistory] = useState([{ time: '00:00', cpu: 0, ram: 0 }])
  const [scanPos, setScanPos] = useState(0)
  const [logs, setLogs] = useState(['> SYSTEM_READY', '> ENCRYPTED_CONNECTION_ESTABLISHED'])

  const addLog = (msg) => {
    setLogs(prev => [`> [${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 12))
  }

  const fetchStats = async () => {
    try {
      const response = await api.getDashboard()
      const d = response.data || {}
      setStats(d)
      
      const cpuVal = parseFloat(d.cpu) || 0
      const memVal = parseFloat(d.currentMem) || 0

      setHistory(prev => {
        const newPoint = {
          time: new Date().toLocaleTimeString().slice(0, 5),
          cpu: cpuVal,
          ram: (memVal / 1024).toFixed(1), // перевод в ГБ если нужно, или оставь в МБ
        }
        return [...prev, newPoint].slice(-15)
      })
    } catch (e) { 
      addLog('TELEMETRY_LINK_LOST...')
    }
  }

  const handleReboot = () => {
    addLog('INITIATING_CORE_REBOOT...')
    setTimeout(() => addLog('CLEARING_CACHE...'), 1000)
    setTimeout(() => addLog('RE-SYNCHRONIZING_NODES...'), 2500)
    setTimeout(() => {
        addLog('SYSTEM_STABLE_V1.2.0');
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
    <Box padding="xl" style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: '"Courier New", monospace' }}>
      
      {/* HEADER: NEON SCANNER */}
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
            <H2 style={{ color: CYBER.primary, marginTop: '10px', letterSpacing: '4px', textShadow: `0 0 10px ${CYBER.primary}44` }}>ADMIN_HUD_V1.2</H2>
          </Box>
          <Button variant="danger" size="sm" onClick={handleReboot} style={{ border: `1px solid ${CYBER.danger}`, fontWeight: 'bold' }}>SYSTEM_RELOAD</Button>
        </Box>
      </Box>

      {/* STATS GRID */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" margin="-sm">
        {[
          { label: 'ACTIVE_AGENTS', val: stats.totalUsers, color: CYBER.primary, unit: '' },
          { label: 'CPU_LOAD', val: stats.cpu, color: CYBER.success, unit: '%' },
          { label: 'MEM_USAGE', val: stats.currentMem, color: CYBER.secondary, unit: 'MB' },
          { label: 'SYSTEM_LOAD', val: (stats.cpu * 0.8).toFixed(1), color: CYBER.warning, unit: 'idx' }
        ].map((item, i) => (
          <Box key={i} width={[1, 1/2, 1/4]} padding="sm">
            <Card style={{ backgroundColor: CYBER.card, border: `1px solid ${item.color}33`, borderRadius: '8px' }}>
              <Box p="md">
                <Text size="xs" style={{ color: '#484f58', fontWeight: 'bold' }}>{item.label}</Text>
                <H2 style={{ color: '#fff', margin: '8px 0' }}>{item.val || 0}<span style={{fontSize: '14px', color: item.color}}>{item.unit}</span></H2>
                <Box width="100%" height="3px" bg="#000">
                  <Box width={`${Math.min(item.val, 100)}%`} height="100%" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}`, transition: 'width 0.8s ease' }} />
                </Box>
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        {/* GRAPH MONITOR */}
        <Box width={[1, 2/3]} paddingRight={['0', 'md']} marginBottom="xl">
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '420px', border: '1px solid #1a222d' }}>
            <H5 mb="xl" style={{ color: CYBER.primary }}>REALTIME_OS_TELEMETRY</H5>
            <ResponsiveContainer width="100%" height="80%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CYBER.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={CYBER.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f242c" vertical={false} />
                <XAxis dataKey="time" stroke="#484f58" tick={{fontSize: 10}} />
                <YAxis stroke="#484f58" tick={{fontSize: 10}} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}`, borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="cpu" stroke={CYBER.primary} fillOpacity={1} fill="url(#colorCpu)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* TERMINAL LOGS */}
        <Box width={[1, 1/3]} paddingLeft={['0', 'md']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: '#000', height: '420px', border: `1px solid ${CYBER.success}33`, overflow: 'hidden' }}>
            <H5 mb="md" style={{ color: CYBER.success }}>CONSOLE_OUTPUT</H5>
            <Box>
                {logs.map((log, i) => (
                <Text key={i} size="xs" mb="xs" style={{ 
                    color: i === 0 ? CYBER.success : '#30363d', 
                    fontFamily: 'monospace',
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
