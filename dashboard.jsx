import React, { useState, useEffect } from 'react'
import { Box, H2, H4, H5, Text, Illustration, Section, Card, Icon, Badge, Button } from '@adminjs/design-system'
import { ApiClient } from 'adminjs'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'

const api = new ApiClient()

// Цветовая схема "Cyber Night"
const CYBER = {
  bg: '#0b0e14',
  card: '#161b22',
  primary: '#00f2fe',
  secondary: '#7000ff',
  success: '#39ff14',
  warning: '#fbc02d',
  text: '#e6edf3'
};

const Dashboard = (props) => {
  const [stats, setStats] = useState(props.data || {})
  const [history, setHistory] = useState([])
  const [scanPos, setScanPos] = useState(0)

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
      }].slice(-30))
    } catch (e) { console.error('System error:', e) }
  }

  useEffect(() => {
    const interval = setInterval(fetchStats, 5000)
    const anim = setInterval(() => setScanPos(p => (p + 1) % 100), 50)
    return () => { clearInterval(interval); clearInterval(anim); }
  }, [])

  return (
    <Box padding="xl" style={{ backgroundColor: CYBER.bg, minHeight: '100vh', color: CYBER.text }}>
      
      {/* HEADER с эффектом сканирования */}
      <Box variant="white" padding="xl" marginBottom="xl" borderRadius="xl" 
           style={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}44`, position: 'relative', overflow: 'hidden' }}>
        <Box style={{ 
            position: 'absolute', top: 0, left: `${scanPos}%`, width: '2px', height: '100%', 
            background: CYBER.primary, boxShadow: `0 0 15px ${CYBER.primary}`, opacity: 0.3 
        }} />
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Badge style={{ background: CYBER.secondary, color: '#fff' }}>SYSTEM STATUS: OPTIMIZED</Badge>
            <H2 style={{ color: CYBER.primary, marginTop: '10px', textShadow: `0 0 10px ${CYBER.primary}44` }}>
              <Icon icon="Terminal" /> NEURAL PULSE // OS_CORE
            </H2>
          </Box>
          <Box textAlign="right">
            <Text size="sm" color="grey60">NODE: np.bothost.tech</Text>
            <H4 color={CYBER.success}>ONLINE</H4>
          </Box>
        </Box>
      </Box>

      {/* КАРТОЧКИ С НЕОНОВОЙ ПОДСВЕТКОЙ */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" margin="-sm">
        {[
          { label: 'AGENTS', val: stats.totalUsers, icon: 'Users', color: CYBER.primary },
          { label: 'CPU LOAD', val: `${stats.cpu}%`, icon: 'Cpu', color: CYBER.success },
          { label: 'MEMORY', val: `${stats.currentMem}MB`, icon: 'Activity', color: CYBER.secondary },
          { label: 'LATENCY', val: `${stats.dbLatency}ms`, icon: 'Database', color: CYBER.warning }
        ].map((item, i) => (
          <Box key={i} width={[1, 1/2, 1/4]} padding="sm">
            <Card style={{ backgroundColor: CYBER.card, border: `1px solid ${item.color}33`, borderRadius: '12px' }}>
              <Box p="md">
                <Box display="flex" alignItems="center" gap="10px" mb="md">
                    <Icon icon={item.icon} color={item.color} />
                    <Text size="xs" style={{ color: item.color, fontWeight: 'bold', letterSpacing: '1px' }}>{item.label}</Text>
                </Box>
                <H2 style={{ color: '#fff' }}>{item.val || 0}</H2>
                <Box width="100%" height="2px" bg={`${item.color}11`} mt="md">
                    <Box width="40%" height="100%" bg={item.color} style={{ boxShadow: `0 0 10px ${item.color}` }} />
                </Box>
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      {/* ГЛАВНЫЙ ГРАФИК (NEON AREA) */}
      <Box display="flex" flexDirection="row" flexWrap="wrap" marginTop="xl">
        <Box width={[1, 2/3]} paddingRight={['0', 'sm']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '450px', border: `1px solid #30363d` }}>
            <H5 mb="xl" style={{ color: CYBER.primary }}>LIVE DATA STREAM</H5>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="glowPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CYBER.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={CYBER.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                <XAxis dataKey="time" stroke="#484f58" fontSize={10} />
                <YAxis stroke="#484f58" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.primary}`, color: '#fff' }} />
                <Area type="monotone" dataKey="cpu" stroke={CYBER.primary} strokeWidth={3} fill="url(#glowPrimary)" />
                <Area type="monotone" dataKey="ram" stroke={CYBER.secondary} strokeWidth={2} fill="transparent" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* СТАТУС БАЗЫ ДАННЫХ */}
        <Box width={[1, 1/3]} paddingLeft={['0', 'sm']} mt={['xl', '0']}>
          <Box padding="lg" borderRadius="xl" style={{ backgroundColor: CYBER.card, height: '450px', border: `1px solid #30363d` }}>
            <H5 mb="md" style={{ color: CYBER.warning }}>DB LATENCY (MS)</H5>
            <ResponsiveContainer width="100%" height="60%">
                <BarChart data={history}>
                    <Bar dataKey="db" fill={CYBER.warning} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            <Box mt="xl" p="md" style={{ background: '#000', borderRadius: '8px', border: '1px solid #333' }}>
                <Text size="xs" color={CYBER.success}>&gt; SESSION_STABLE: TRUE</Text>
                <Text size="xs" color={CYBER.success}>&gt; ENCRYPTION: AES-256</Text>
                <Text size="xs" color={CYBER.primary}>&gt; READY FOR JETTON MINT...</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ROADMAP SECTION */}
      <Section marginTop="xl">
        <Box padding="xl" borderRadius="xl" textAlign="center" 
             style={{ backgroundColor: CYBER.card, border: `1px solid ${CYBER.secondary}44` }}>
          <H4 style={{ color: '#fff', mb: 'md' }}>TON BLOCKCHAIN INTEGRATION</H4>
          <Box display="flex" justifyContent="center" gap="20px" my="xl">
             <Badge style={{ background: '#222', color: CYBER.primary, border: `1px solid ${CYBER.primary}` }}>MINTING: 30%</Badge>
             <Badge style={{ background: '#222', color: CYBER.secondary, border: `1px solid ${CYBER.secondary}` }}>STAKING: WAITING</Badge>
          </Box>
          <Box height="10px" bg="#000" borderRadius="xl" width="80%" margin="0 auto" position="relative">
             <Box width="30%" height="100%" bg={CYBER.secondary} style={{ boxShadow: `0 0 15px ${CYBER.secondary}`, borderRadius: 'xl' }} />
          </Box>
          <Text mt="md" size="sm" color="grey60">Target Emission: 102,700,000,000 $NPULSE</Text>
        </Box>
      </Section>

    </Box>
  )
}

export default Dashboard
