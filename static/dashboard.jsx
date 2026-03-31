import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { 
  TonConnectUIProvider, 
  TonConnectButton, 
  useTonAddress 
} from '@tonconnect/ui-react';

// --- 🌌 CONFIG & COLORS ---
const CYBER = {
  bg: '#020406',
  card: 'rgba(6, 9, 13, 0.95)',
  primary: '#00f2fe',    
  success: '#39ff14',   
  danger: '#ff003c',    
  ton: '#0088CC',
  text: '#e2e8f0',
  border: 'rgba(0, 242, 254, 0.25)',
};

const DashboardContent = (props) => {
  // Вытаскиваем данные, которые передает AdminJS
  const { data, resource, action } = props;
  
  const [isMounted, setIsMounted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);
  const userAddress = useTonAddress();

  // --- 📝 СИСТЕМА ГЛУБОКОГО ЛОГИРОВАНИЯ ---
  const addLog = useCallback((text, type = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'ERROR' ? '❌' : type === 'WARN' ? '⚠️' : '>';
    const newLog = `${prefix} [${timestamp}] ${text}`;
    setLogs(prev => [...prev.slice(-99), newLog]);
  }, []);

  // 1. ПРОВЕРКА ОКРУЖЕНИЯ И ОШИБОК БРАУЗЕРА
  useEffect(() => {
    setIsMounted(true);
    addLog("DIAGNOSTICS_START: INITIALIZING_DEBUG_LAYER");

    // Перехват JS ошибок
    const handleError = (event) => {
      addLog(`RUNTIME_ERROR: ${event.message}`, 'ERROR');
    };

    // Перехват ошибок сетевых запросов (Promise)
    const handleRejection = (event) => {
      addLog(`PROMISE_REJECTED: ${event.reason}`, 'ERROR');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addLog]);

  // 2. АУДИТ ДАННЫХ ОТ ADMINJS
  useEffect(() => {
    if (isMounted) {
      addLog(`ADMINJS_STATUS: RESOURCE=${resource?.id || 'unknown'}`);
      addLog(`ADMINJS_STATUS: ACTION=${action?.name || 'unknown'}`);
      
      if (!data) {
        addLog("DATA_PAYLOAD: EMPTY (Check server.js controller)", "WARN");
      } else {
        addLog(`DATA_PAYLOAD: RECEIVED (${Object.keys(data).length} keys)`);
        // Проверка конкретных полей твоего проекта
        if (!data.totalUsers) addLog("CORE_VAL_MISSING: totalUsers", "WARN");
      }
    }
  }, [isMounted, data, resource, action, addLog]);

  // 3. ИМИТАЦИЯ ЗАГРУЗКИ
  useEffect(() => {
    if (isMounted) {
      const timer = setTimeout(() => {
        setIsLoaded(true);
        addLog("UI_RENDER_SUCCESS: READY_FOR_OPERATIONS");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isMounted, addLog]);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  if (!isMounted) return null;

  return (
    <div className="debug-root">
      <style>{`
        .debug-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
        .log-container { 
          height: 350px; 
          overflow-y: auto; 
          background: #000; 
          padding: 15px; 
          border: 1px solid ${CYBER.border}; 
          font-size: 11px; 
          line-height: 1.5; 
        }
        .log-line { margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 2px; }
        .label { font-size: 10px; color: ${CYBER.primary}; letter-spacing: 2px; margin-bottom: 10px; display: block; }
        .error-text { color: ${CYBER.danger}; font-weight: bold; }
        .warn-text { color: #ffaa00; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0 }}>NEURAL_PULSE_DEBUG</h1>
          <div style={{ fontSize: '10px', opacity: 0.6 }}>SYSTEM_AUDIT_MODE // v1.2.0</div>
        </div>
        <TonConnectButton />
      </div>

      <div className="card">
        <span className="label">Full_System_Telemetry</span>
        <div className="log-container">
          {logs.length === 0 && <div className="log-line">Waiting for telemetry...</div>}
          {logs.map((log, i) => {
            const isError = log.includes('❌');
            const isWarn = log.includes('⚠️');
            return (
              <div key={i} className={`log-line ${isError ? 'error-text' : isWarn ? 'warn-text' : ''}`}>
                {log}
              </div>
            );
          })}
          <div ref={logRef} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div className="card">
          <span className="label">Bridge_Status</span>
          <div>TON_ADDRESS: {userAddress || 'DISCONNECTED'}</div>
          <div>STATUS: {isLoaded ? 'ONLINE' : 'CONNECTING...'}</div>
        </div>
        <div className="card">
          <span className="label">AdminJS_Data_Snapshot</span>
          <pre style={{ fontSize: '9px', opacity: 0.7 }}>
            {JSON.stringify({ resource: resource?.id, action: action?.name }, null, 2)}
          </pre>
        </div>
      </div>

      {/* Кнопка для ручной проверки связи с сервером */}
      <button 
        onClick={async () => {
          addLog("PING_START: TESTING_API_ENDPOINT...");
          try {
            const res = await fetch('/api/admin/command', { method: 'POST' });
            addLog(`PING_END: SERVER_RESPONDED_WITH_${res.status}`);
          } catch (e) {
            addLog(`PING_CRITICAL_FAIL: ${e.message}`, 'ERROR');
          }
        }}
        style={{
          width: '100%',
          padding: '12px',
          background: 'none',
          border: `1px solid ${CYBER.primary}`,
          color: CYBER.primary,
          cursor: 'pointer',
          marginTop: '10px'
        }}
      >
        TEST_SERVER_CONNECTION (FORCE_FETCH)
      </button>
    </div>
  );
};

const Dashboard = (props) => {
  return (
    <TonConnectUIProvider manifestUrl="https://np.bothost.tech/tonconnect-manifest.json">
      <DashboardContent {...props} />
    </TonConnectUIProvider>
  );
};

export default Dashboard;
