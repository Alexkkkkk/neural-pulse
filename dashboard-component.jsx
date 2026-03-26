import React from 'react'
import { Box, H2, H5, Text, Illustration, Section, Card, Icon } from '@adminjs/design-system'

const Dashboard = (props) => {
  // Деструктуризация с защитой от undefined (если данные еще не подгрузились)
  const { 
    totalUsers = 0, 
    currentMem = 0, 
    dbLatency = 0, 
    cpu = 0 
  } = props.data || {}

  return (
    <Box variant="grey" padding="xl">
      {/* Шапка дашборда */}
      <Box variant="white" padding="xl" marginBottom="xl" boxShadow="card" borderRadius="lg">
        <H2>Neural Pulse: Command Center</H2>
        <Text>Мониторинг узлов системы в реальном времени. Статус: <b>Active</b></Text>
      </Box>

      {/* Сетка карточек со статистикой */}
      <Box display="flex" flexDirection="row" flexWrap="wrap">
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color="primary100"><Icon icon="User" /> Агенты (Users)</H5>
            <H2>{totalUsers}</H2>
            <Text size="sm">Зарегистрировано в базе</Text>
          </Card>
        </Box>

        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color="success"><Icon icon="Cpu" /> Нагрузка CPU</H5>
            <H2>{cpu}%</H2>
            <Text size="sm">Использование ядра NL2</Text>
          </Card>
        </Box>

        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color="info"><Icon icon="Layers" /> Память RAM</H5>
            <H2>{currentMem} MB</H2>
            <Text size="sm">Занято процессом Node.js</Text>
          </Card>
        </Box>

        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color={dbLatency < 100 ? "success" : "danger"}><Icon icon="Database" /> Отклик БД</H5>
            <H2>{dbLatency} ms</H2>
            <Text size="sm">Задержка SQL запроса</Text>
          </Card>
        </Box>
      </Box>

      {/* Блок интеграции */}
      <Section marginTop="xl">
        <Box variant="white" padding="xl" boxShadow="card" borderRadius="lg">
            <Illustration variant="Rocket" width="80px" />
            <H5>Интеграция TON Blockchain</H5>
            <Text>Модуль TonConnect готов к подключению манифеста. Webhook активен.</Text>
        </Box>
      </Section>
    </Box>
  )
}

export default Dashboard
