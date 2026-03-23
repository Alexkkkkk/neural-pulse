import React from 'react'
import { Box, H2, H5, Text, Illustration, Section, Card } from '@adminjs/design-system'

const Dashboard = (props) => {
  const { totalUsers, currentMem, dbStatus, serverStatus } = props.data

  return (
    <Box variant="grey">
      <Box variant="white" padding="xl" marginBottom="xl">
        <H2>Neural Pulse: System OS</H2>
        <Text>Добро пожаловать в центр управления терминалом. Ниже приведена сводка состояния системы.</Text>
      </Box>

      <Box display="flex" flexDirection="row" flexWrap="wrap">
        {/* Карточка: Пользователи */}
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card variant="white" padding="md">
            <H5 color="primary100">Игроков в сети</H5>
            <H2>{totalUsers}</H2>
            <Text size="sm">Общее количество регистраций</Text>
          </Card>
        </Box>

        {/* Карточка: Память */}
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card variant="white" padding="md">
            <H5 color="success">Загрузка RAM</H5>
            <H2>{currentMem} MB</H2>
            <Text size="sm">Потребление памяти сервером</Text>
          </Card>
        </Box>

        {/* Карточка: База данных */}
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card variant="white" padding="md">
            <H5 color="info">Статус БД</H5>
            <H2>{dbStatus}</H2>
            <Text size="sm">Время отклика (Latency)</Text>
          </Card>
        </Box>

        {/* Карточка: Сервер */}
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card variant="white" padding="md">
            <H5 color="danger">Node.js</H5>
            <H2>{serverStatus}</H2>
            <Text size="sm">Локация: Нидерланды (NL2)</Text>
          </Card>
        </Box>
      </Box>

      <Section marginBottom="xl">
        <Illustration variant="Rocket" width="100px" />
        <H5>Подключение TON</H5>
        <Text>Графики пополнений будут доступны после интеграции TonConnect API.</Text>
      </Section>
    </Box>
  )
}

export default Dashboard
