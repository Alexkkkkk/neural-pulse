import React from 'react'
import { Box, H2, H5, Text, Illustration, Section, Card, Icon, Badge } from '@adminjs/design-system'

const Dashboard = (props) => {
  const { totalUsers, newUsers24h, currentMem, dbLatency, cpu } = props.data

  return (
    <Box variant="grey" padding="xl">
      <Box variant="white" padding="xl" marginBottom="xl" boxShadow="card" borderRadius="lg">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <H2>Neural Pulse: Command Center</H2>
            <Text>Проект на стадии бета-тестирования. Ниже актуальные показатели системы.</Text>
          </Box>
          <Badge variant="primary">v1.2.0 Active</Badge>
        </Box>
      </Box>

      <Box display="flex" flexDirection="row" flexWrap="wrap">
        {/* Карточка Пользователей */}
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color="primary100"><Icon icon="Users" /> Игроков</H5>
            <H2>{totalUsers}</H2>
            <Text size="sm" color="success">+{newUsers24h} за 24 часа</Text>
          </Card>
        </Box>

        {/* Карточка CPU */}
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color="success"><Icon icon="Cpu" /> Нагрузка CPU</H5>
            <H2>{cpu}%</H2>
            <Text size="sm">Среднее значение (1m)</Text>
          </Card>
        </Box>

        {/* Карточка RAM */}
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color="info"><Icon icon="Activity" /> RAM (Memory)</H5>
            <H2>{currentMem} MB</H2>
            <Text size="sm">Heap Usage</Text>
          </Card>
        </Box>

        {/* Карточка Latency */}
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color={dbLatency < 100 ? "success" : "danger"}><Icon icon="Database" /> Latency</H5>
            <H2>{dbLatency} ms</H2>
            <Text size="sm">Отклик PostgreSQL</Text>
          </Card>
        </Box>
      </Box>

      <Section marginTop="xl">
        <Box variant="white" padding="xl" boxShadow="card" textAlign="center" borderRadius="lg">
            <Illustration variant="Rocket" width="80px" />
            <H5 marginTop="md">Интеграция TON & Jetton</H5>
            <Text marginBottom="md">Блокчейн-графики будут активированы после деплоя смарт-контракта.</Text>
            <Box variant="grey" height="10px" borderRadius="10px" width="50%" margin="0 auto" overflow="hidden">
               <Box variant="primary" width="30%" height="100%" /> 
            </Box>
            <Text size="xs" marginTop="sm">Прогресс разработки: 30%</Text>
        </Box>
      </Section>
    </Box>
  )
}

export default Dashboard
