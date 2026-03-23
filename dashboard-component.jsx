import React from 'react'
import { Box, H2, H5, Text, Illustration, Section, Card, Icon } from '@adminjs/design-system'

const Dashboard = (props) => {
  const { totalUsers, currentMem, dbLatency, cpu } = props.data

  return (
    <Box variant="grey" padding="xl">
      <Box variant="white" padding="xl" marginBottom="xl" boxShadow="card">
        <H2>Neural Pulse: Command Center</H2>
        <Text>Проект на стадии бета-тестирования. Ниже актуальные показатели системы.</Text>
      </Box>

      <Box display="flex" flexDirection="row" flexWrap="wrap">
        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color="primary100"><Icon icon="User" /> Игроков</H5>
            <H2>{totalUsers}</H2>
            <Text size="sm">Всего регистраций</Text>
          </Card>
        </Box>

        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color="success"><Icon icon="Cpu" /> Нагрузка CPU</H5>
            <H2>{cpu}%</H2>
            <Text size="sm">Загрузка процессора NL2</Text>
          </Card>
        </Box>

        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color="info"><Icon icon="Layers" /> RAM (Memory)</H5>
            <H2>{currentMem} MB</H2>
            <Text size="sm">Использование памяти</Text>
          </Card>
        </Box>

        <Box width={[1, 1/2, 1/4]} padding="sm">
          <Card padding="md">
            <H5 color={dbLatency < 100 ? "success" : "danger"}><Icon icon="Database" /> Latency</H5>
            <H2>{dbLatency} ms</H2>
            <Text size="sm">Скорость работы базы</Text>
          </Card>
        </Box>
      </Box>

      <Section marginTop="xl">
        <Box variant="white" padding="xl" boxShadow="card">
            <Illustration variant="Rocket" width="80px" />
            <H5>Интеграция TON</H5>
            <Text>Блокчейн-графики будут активированы после настройки TonConnect.</Text>
        </Box>
      </Section>
    </Box>
  )
}

export default Dashboard
