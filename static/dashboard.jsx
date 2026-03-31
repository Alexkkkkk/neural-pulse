import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const { data, resource, action } = props;
  
  const [isMounted, setIsMounted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);
  
  // Безопасное получение адреса TON
  let userAddress = "";
  try {
    userAddress = useTonAddress();
  } catch (e) {
    console.error("TonConnect Hook Error", e);
  }

  // --- 📝 СИСТЕМА ЛОГИРОВАНИЯ (Оптимизирована для RAM на Bothost) ---
  const addLog = useCallback((text, type = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'ERROR' ? '❌' : type === 'WARN' ? '⚠️' : '>';
    const newLog = `${prefix} [${timestamp}] ${text}`;
    // Лимит 50 строк предотвращает утечки памяти и тормоза AdminJS
    setLogs(prev => [...prev.slice(-49), newLog]);
  }, []);

  // 1. ИНИЦИАЛИЗАЦИЯ И МОНИТОРИНГ ОШИБОК
  useEffect(() => {
    setIsMounted(true);
    addLog("DIAGNOSTICS_START: INITIALIZING_DEBUG_LAYER");

    const handleError = (event) => addLog(`RUNTIME_ERROR: ${event.message}`, 'ERROR');
    const handleRejection = (event) => addLog(`PROMISE_REJECTED: ${event.reason}`, 'ERROR');

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Имитация прогресса загрузки
    const timer = setTimeout(() => {
      setIsLoaded(true);
      addLog("UI_RENDER_SUCCESS: READY_FOR_OPERATIONS");
    }, 1000);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      clearTimeout(timer);
    };
  }, [addLog]);

  // 2. АУДИТ КОНТЕКСТА ADMINJS
  useEffect(() => {
    if (isMounted) {
      addLog(`ADMINJS_STATUS: RESOURCE=${resource?.id || 'unknown'}`);
      addLog(`ADMINJS_STATUS: ACTION=${action?.name || 'unknown'}`);
      
      if (!data || Object.keys(data).length === 0) {
        addLog("DATA_PAYLOAD: EMPTY_OR_MINIMAL", "WARN");
      } else {
        addLog(`DATA_PAYLOAD: RECEIVED (${Object.keys(data).length} keys)`);
      }
    }
  }, [isMounted, resource, action, data, addLog]);

  // Авто-скролл контейнера логов
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isMounted) return null;

  return (
    <div className="debug-root">
      <style>{`
        .debug-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'JetBrains Mono', monospace; color: ${CYBER.text}; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
        .log-container { 
          height: 300px; 
          overflow-y: auto; 
          background: #000; 
          padding: 12px; 
          border: 1px solid ${CYBER.border}; 
          font-size: 11px; 
          line-height: 1.4;
          scroll-behavior: smooth;
        }
        .log-line { margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 2px; }
        .label { font-size: 10px; color: ${CYBER.primary}; letter-spacing: 1px; margin-bottom: 8px; display: block; text-transform: uppercase; }
        .error-text { color: ${CYBER.danger}; font-weight: bold; }
        .warn-text { color: #ffaa00; }
        .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .cyber-btn {
          width: 100%; padding: 12px; background: none; 
          border: 1px solid ${CYBER.primary}; color: ${CYBER.primary}; 
          cursor: pointer; font-family: inherit; transition: 0.3s;
          text-transform: uppercase; letter-spacing: 1px; margin-top: 10px;
        }
        .cyber-btn:hover { background: rgba(0, 242, 254, 0.1); box-shadow: 0 0 10px ${CYBER.border}; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '24px' }}>NEURAL_PULSE_DEBUG</h1>
          <div style={{ fontSize: '10px', opacity: 0.6 }}>SYSTEM_AUDIT_MODE // v1.2.0</div>
        </div>
        <TonConnectButton />
      </div>

      <div className="card">
        <span className="label">Telemetry_Stream</span>
        <div className="log-container" ref={logRef}>
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
        </div>
      </div>

      <div className="status-grid">
        <div className="card">
          <span className="label">Bridge_Status</span>
          <div style={{fontSize: '12px'}}>ADDRESS: {userAddress ? `${userAddress.slice(0,6)}...${userAddress.slice(-4)}` : 'DISCONNECTED'}</div>
          <div style={{fontSize: '11px', color: userAddress ? CYBER.success : CYBER.danger, marginTop: '5px'}}>
            STATUS: {userAddress ? 'ACTIVE_SESSION' : 'WAITING_AUTH'}
          </div>
        </div>
        <div className="card">
          <span className="label">AdminJS_Snapshot</span>
          <pre style={{ fontSize: '10px', opacity: 0.7, margin: 0, color: CYBER.primary }}>
            {JSON.stringify({ res: resource?.id, act: action?.name, status: isLoaded ? 'READY' : 'INIT' }, null, 1)}
          </pre>
        </div>
      </div>

      <button className="cyber-btn" onClick={async () => {
          addLog("PING: TESTING_SERVER_GATEWAY...");
          try {
            const res = await fetch('/api/admin/command', { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            addLog(`PONG: SERVER_RESPONSE_${res.status}`);
          } catch (e) {
            addLog(`FAIL: ${e.message}`, 'ERROR');
          }
      }}>
        Execute Diagnostic Ping
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
