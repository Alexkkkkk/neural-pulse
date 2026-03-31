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
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);
  
  // Безопасное получение адреса
  let userAddress = "";
  try {
    userAddress = useTonAddress();
  } catch (e) {
    console.error("TonConnect Hook Error", e);
  }

  // --- 📝 ОПТИМИЗИРОВАННОЕ ЛОГИРОВАНИЕ ---
  const addLog = useCallback((text, type = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'ERROR' ? '❌' : type === 'WARN' ? '⚠️' : '>';
    const newLog = `${prefix} [${timestamp}] ${text}`;
    // Ограничение до 50 строк для экономии RAM на Bothost
    setLogs(prev => [...prev.slice(-49), newLog]);
  }, []);

  // 1. Инициализация
  useEffect(() => {
    setIsMounted(true);
    addLog("SYSTEM_BOOT: NEURAL_PULSE_OS_READY");

    const handleError = (event) => addLog(`RUNTIME_ERROR: ${event.message}`, 'ERROR');
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [addLog]);

  // 2. Аудит данных AdminJS
  useEffect(() => {
    if (isMounted) {
      addLog(`CONTEXT: RES=${resource?.id || 'GLOBAL'} | ACT=${action?.name || 'VIEW'}`);
    }
  }, [isMounted, resource, action, addLog]);

  // Авто-скролл логов
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
        }
        .log-line { margin-bottom: 2px; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 2px; }
        .label { font-size: 10px; color: ${CYBER.primary}; letter-spacing: 1px; margin-bottom: 8px; display: block; }
        .error-text { color: ${CYBER.danger}; font-weight: bold; }
        .warn-text { color: #ffaa00; }
        .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .cyber-btn {
          width: 100%; padding: 12px; background: none; 
          border: 1px solid ${CYBER.primary}; color: ${CYBER.primary}; 
          cursor: pointer; font-family: inherit; transition: 0.3s;
        }
        .cyber-btn:hover { background: rgba(0, 242, 254, 0.1); box-shadow: 0 0 10px ${CYBER.border}; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '24px' }}>NEURAL_PULSE_DEBUG</h1>
          <div style={{ fontSize: '10px', opacity: 0.6 }}>OPTIMIZED_MEMORY_MODE // v1.2.0</div>
        </div>
        <TonConnectButton />
      </div>

      <div className="card">
        <span className="label">Telemetry_Stream</span>
        <div className="log-container" ref={logRef}>
          {logs.map((log, i) => (
            <div key={i} className={`log-line ${log.includes('❌') ? 'error-text' : log.includes('⚠️') ? 'warn-text' : ''}`}>
              {log}
            </div>
          ))}
        </div>
      </div>

      <div className="status-grid">
        <div className="card">
          <span className="label">Neural_Link</span>
          <div style={{fontSize: '12px'}}>ADDRESS: {userAddress ? `${userAddress.slice(0,6)}...${userAddress.slice(-4)}` : 'DISCONNECTED'}</div>
          <div style={{fontSize: '11px', color: userAddress ? CYBER.success : CYBER.danger}}>
            STATUS: {userAddress ? 'ACTIVE_SESSION' : 'WAITING_AUTH'}
          </div>
        </div>
        <div className="card">
          <span className="label">Data_Snapshot</span>
          <pre style={{ fontSize: '10px', opacity: 0.7, margin: 0 }}>
            {JSON.stringify({ res: resource?.id, act: action?.name }, null, 1)}
          </pre>
        </div>
      </div>

      <button className="cyber-btn" onClick={async () => {
          addLog("PING: TESTING_SERVER_GATEWAY...");
          try {
            const res = await fetch('/api/admin/command', { method: 'POST' });
            addLog(`PONG: STATUS_${res.status}`);
          } catch (e) {
            addLog(`FAIL: ${e.message}`, 'ERROR');
          }
      }}>
        EXECUTE_DIAGNOSTIC_PING
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
