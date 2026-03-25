import React, { useState, useEffect } from 'react'
import { Box, H2, H4, H5, Text, Card, Icon, Badge, Button } from '@adminjs/design-system'
import { ApiClient } from 'adminjs'
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell
} from 'recharts'

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

const TOKENOMICS_DATA = [
  { name: 'Public Sale', value: 40, color: '#00f2fe' },
  { name: 'Ecosystem', value: 30, color: '#7000ff' },
  { name: 'Team', value: 20, color: '#39ff14' },
  { name: 'Liquidity', value: 10, color: '#fbc02d' },
];

const Dashboard = (props) => {
  const [stats, setStats] = useState(props.data || {})
  const [history, setHistory] = useState([])
  const [scanPos, setScanPos] = useState(0)
  const [logs, setLogs] = useState(['> Инициализация ядра...', '> Подключение к TON Mainnet...'])

  const addLog = (msg) => setLogs(prev => [`> [${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 7))

  const fetchStats = async () => {
    try {
      const response = await api.getDashboard()
      const d = response.data || {}
      setStats(d)
      setHistory(prev => [...prev, {
        time: new Date().toLocaleTimeString().slice(0, 5),
        cpu: parseFloat(d.cpu || 0),
        ram: parseFloat(d.currentMem || 0),
        db: parseFloat(d.dbLatency || 0),
      }].slice(-20))
    } catch (e) { console.error('Pulse Error:', e) }
  }

  useEffect(() => {
    const interval = setInterval(fetchStats, 5000)
    const anim = setInterval(() => setScanPos(p => (p + 1) % 100), 50)
    return () => { clearInterval(interval); clearInterval(anim); }
  }, [])

  return (
    <Box padding="xl" style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text, fontFamily: 'monospace' }}>
      
      {/* HEADER */}
      <Box padding="xl" marginBottom="xl" borderRadius="xl" 
           style={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden' }}>
        <Box style={{ position: 'absolute', top: 0, left: `${scanPos}%`, width: '3px', height: '100%', background: CYBER.primary, opacity: 0.3 }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Badge style={{ background: CYBER.success, color: '#000' }}>CORE_V1.2.0_ACTIVE</Badge>
            <H2 style={{ color: CYBER.primary, marginTop: '10px' }}>NEURAL PULSE // TERMINAL</H2>
          </Box>
          <Box display="flex" gap="md">
            <Button variant="danger" size="sm" onClick={() => addLog('CORE REBOOT INITIATED')}>REBOOT</Button>
          </Box>
        </Box>
      </Box>

      {/* STATS CARDS */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" margin="-sm">
        {[
          { label: 'AGENTS', val: stats.totalUsers, icon: 'Users', color: CYBER.primary },
          { label: 'CPU', val: `${stats.cpu || 0}%`, icon: 'Activity', color: CYBER.success },
          { label: 'RAM', val: `${stats.currentMem || 0}MB`, icon: 'Layers', color: CYBER.secondary },
          { label: 'DB PING', val: `${stats.dbLatency || 0}ms`, icon: 'Database', color: CYBER.warning }
        ].map((item, i) => (
          <Box key={i} width={[1, 1/2, 1/4]} padding="sm">
            <Card style={{ backgroundColor: CYBER.card, border: `1px solid ${item.color}33`, borderRadius: '16px' }}>
              <Box p="md">
                <Text size="xs" color="grey60">{item.label}</Text>
                <H2 style={{ color: '#fff' }}>{item.val || 0}</H2>
                <Box width="100%" height="4px" bg="#000" mt="md"><Box width="60%" height="100%" bg={item.color} /></Box>
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      {/* CHARTS */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        <Box width={[1, 2/3]} paddingRight={['0', 'sm']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '400px', border: '1px solid #30363d' }}>
            <H5 mb="xl" color={CYBER.primary}>TELEMETRY HISTORY</H5>
            <ResponsiveContainer width="100%" height="80%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f242c" />
                <XAxis dataKey="time" stroke="#484f58" />
                <YAxis stroke="#484f58" />
                <Tooltip contentStyle={{ backgroundColor: CYBER.card }} />
                <Area type="monotone" dataKey="cpu" stroke={CYBER.primary} fill={CYBER.primary} fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        <Box width={[1, 1/3]} paddingLeft={['0', 'sm']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: '#000', height: '400px', border: `1px solid ${CYBER.success}33` }}>
            <H5 mb="md" color={CYBER.success}>LIVE_LOGS</H5>
            {logs.map((log, i) => (
              <Text key={i} color={i === 0 ? CYBER.success : 'grey60'} size="xs" mb="xs">{log}</Text>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default Dashboard;
