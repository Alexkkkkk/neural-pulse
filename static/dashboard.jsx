import React, { useState, useEffect } from 'react'
import { Box, H2, H4, H5, Text, Card, Icon, Badge, Button } from '@adminjs/design-system'
import { ApiClient } from 'adminjs'
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell
} from 'recharts'

const api = new ApiClient()

// Цветовая палитра Neural Pulse "Overdrive"
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
      const d = response.data
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
      
      {/* --- ВЕРХНЯЯ ПАНЕЛЬ (COMMAND CENTER) --- */}
      <Box padding="xl" marginBottom="xl" borderRadius="xl" 
           style={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden', boxShadow: `0 0 20px ${CYBER.primary}11` }}>
        <Box style={{ 
            position: 'absolute', top: 0, left: `${scanPos}%`, width: '3px', height: '100%', 
            background: `linear-gradient(to bottom, transparent, ${CYBER.primary}, transparent)`, opacity: 0.5 
        }} />
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Box display="flex" alignItems="center" gap="10px">
              <Badge style={{ background: CYBER.success, color: '#000', fontWeight: 'bold' }}>CORE_V1.2.0_ACTIVE</Badge>
              <Text color="grey60">System: Operational</Text>
            </Box>
            <H2 style={{ color: CYBER.primary, marginTop: '10px', textShadow: `0 0 15px ${CYBER.primary}66`, letterSpacing: '2px' }}>
              <Icon icon="Cpu" /> NEURAL PULSE // OVERSEER
            </H2>
          </Box>
          <Box display="flex" gap="md">
            <Button variant="danger" size="sm" onClick={() => addLog('CORE REBOOT INITIATED')}><Icon icon="RefreshCcw" /> REBOOT</Button>
            <Button variant="primary" size="sm" onClick={() => addLog('SYNCING WITH TON...')}><Icon icon="Share2" /> SYNC TON</Button>
          </Box>
        </Box>
      </Box>

      {/* --- КАРТОЧКИ МОНИТОРИНГА --- */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" margin="-sm">
        {[
          { label: 'NETWORK AGENTS', val: stats.totalUsers, icon: 'Users', color: CYBER.primary, trend: '+12%' },
          { label: 'CPU INTELLECT', val: `${stats.cpu}%`, icon: 'Activity', color: CYBER.success, trend: 'STABLE' },
          { label: 'MEMORY BUFFER', val: `${stats.currentMem}MB`, icon: 'Layers', color: CYBER.secondary, trend: 'OPTIMIZED' },
          { label: 'DATABASE PING', val: `${stats.dbLatency}ms`, icon: 'Database', color: CYBER.warning, trend: 'FAST' }
        ].map((item, i) => (
          <Box key={i} width={[1, 1/2, 1/4]} padding="sm">
            <Card style={{ backgroundColor: CYBER.card, border: `1px solid ${item.color}33`, borderRadius: '16px', position: 'relative' }}>
              <Box p="md">
                <Box display="flex" justifyContent="space-between" mb="md">
                  <Icon icon={item.icon} color={item.color} />
                  <Text size="xs" color={item.color}>{item.trend}</Text>
                </Box>
                <Text size="xs" style={{ color: 'grey60', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.label}</Text>
                <H2 style={{ color: '#fff', margin: '5px 0' }}>{item.val || 0}</H2>
                <Box width="100%" height="4px" bg="#000" mt="md" borderRadius="xl">
                    <Box width="60%" height="100%" bg={item.color} style={{ boxShadow: `0 0 10px ${item.color}`, borderRadius: 'xl' }} />
                </Box>
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      {/* --- ГРАФИКИ И ТЕРМИНАЛ --- */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        <Box width={[1, 2/3]} paddingRight={['0', 'sm']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '400px', border: `1px solid #30363d` }}>
            <H5 mb="xl" color={CYBER.primary}>REAL-TIME NEURAL TELEMETRY</H5>
            <ResponsiveContainer width="100%" height="80%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="glowP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CYBER.primary} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={CYBER.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="#1f242c" vertical={false} />
                <XAxis dataKey="time" stroke="#484f58" fontSize={10} />
                <YAxis stroke="#484f58" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}`, borderRadius: '8px' }} />
                <Area type="step" dataKey="cpu" stroke={CYBER.primary} strokeWidth={2} fill="url(#glowP)" />
                <Area type="monotone" dataKey="ram" stroke={CYBER.secondary} strokeWidth={2} fill="transparent" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        <Box width={[1, 1/3]} paddingLeft={['0', 'sm']} mt={['xl', '0']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: '#000', height: '400px', border: `1px solid ${CYBER.success}33` }}>
            <H5 mb="md" color={CYBER.success}><Icon icon="Terminal" /> LIVE_LOGS</H5>
            <Box style={{ fontFamily: 'monospace', fontSize: '11px', overflowY: 'hidden', height: '220px' }}>
              {logs.map((log, i) => (
                <Text key={i} color={i === 0 ? CYBER.success : 'grey60'} mb="xs">{log}</Text>
              ))}
            </Box>
            <Box mt="xl" pt="xl" style={{ borderTop: '1px solid #1f242c' }}>
               <Text size="xs" color={CYBER.primary}>&gt; AI_MODEL: GPT-4O_READY</Text>
               <Text size="xs" color={CYBER.warning}>&gt; TON_MINT_STATUS: ARMED</Text>
               <Text size="xs" color={CYBER.danger}>&gt; SECURITY: LEVEL_MAX</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* --- ТОКЕНОМИКА И РОАДМАП --- */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        <Box width={[1, 1/3]} paddingRight={['0', 'sm']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '350px', border: `1px solid #30363d` }}>
            <H5 mb="md" color={CYBER.secondary}>TOKENOMICS DISTRIBUTION</H5>
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie data={TOKENOMICS_DATA} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {TOKENOMICS_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <Box display="flex" justifyContent="center" gap="sm" flexWrap="wrap">
               {TOKENOMICS_DATA.map(d => <Badge key={d.name} style={{ fontSize: '8px', background: '#000', color: d.color }}>{d.name}</Badge>)}
            </Box>
          </Box>
        </Box>

        <Box width={[1, 2/3]} paddingLeft={['0', 'sm']} mt={['xl', '0']}>
          <Box padding="xl" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '350px', border: `1px solid ${CYBER.secondary}44` }}>
            <H4 color="#fff">TON BLOCKCHAIN DEPLOYMENT</H4>
            <Text color="grey60" mb="xl">Target: 102.7B $NPULSE (Notcoin standard)</Text>
            
            <Box mt="xl">
              <Box display="flex" justifyContent="space-between" mb="sm">
                <Text size="sm">Smart Contract Audit</Text>
                <Badge variant="success">90%</Badge>
              </Box>
              <Box height="8px" bg="#000" borderRadius="xl"><Box width="90%" height="100%" bg={CYBER.success} style={{ boxShadow: `0 0 10px ${CYBER.success}` }} /></Box>
            </Box>

            <Box mt="xl">
              <Box display="flex" justifyContent="space-between" mb="sm">
                <Text size="sm">Jetton Minting Process</Text>
                <Badge style={{ background: CYBER.primary, color: '#000' }}>30%</Badge>
              </Box>
              <Box height="8px" bg="#000" borderRadius="xl"><Box width="30%" height="100%" bg={CYBER.primary} style={{ boxShadow: `0 0 10px ${CYBER.primary}` }} /></Box>
            </Box>

            <Box mt="xl" display="flex" gap="md">
               <Button size="sm" variant="primary" style={{ flex: 1, boxShadow: `0 0 10px ${CYBER.primary}44` }} onClick={() => addLog('MINTING INITIATED')}>INITIATE MINT</Button>
               <Button size="sm" style={{ flex: 1, background: 'transparent', border: `1px solid ${CYBER.secondary}`, color: '#fff' }}>VIEW ON TONSCAN</Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default Dashboard
