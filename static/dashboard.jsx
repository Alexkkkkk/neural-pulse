import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- 🌌 CONFIG & COLORS ---
const CYBER = {
  bg: '#020406',
  card: 'rgba(6, 9, 13, 0.95)',
  primary: '#00f2fe',    
  success: '#39ff14',   
  danger: '#ff003c',    
  text: '#e2e8f0',
  border: 'rgba(0, 242, 254, 0.25)',
};

const Dashboard = (props) => {
  const { data, resource, action } = props;
  
  const [isMounted, setIsMounted] = useState(false);
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);

  // Облегченная система логирования
  const addLog = useCallback((text, type = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'ERROR' ? '❌' : type === 'WARN' ? '⚠️' : '>';
    const newLog = `${prefix} [${timestamp}] ${text}`;
    setLogs(prev => [...prev.slice(-29), newLog]); // Лимит 30 строк для RAM
  }, []);

  useEffect(() => {
    setIsMounted(true);
    addLog("DIAGNOSTICS_START: INITIALIZING_DEBUG_LAYER");
    
    // Подгружаем историю из хендлера AdminJS (если передана)
    if (data?.history) {
        addLog(`LOADED: ${data.history.length} HISTORY_NODES`);
    }

    return () => setIsMounted(false);
  }, [addLog, data]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isMounted) return null;

  return (
    <div className="debug-root">
      <style>{`
        .debug-root { background: ${CYBER.bg}; min-height: 100vh; padding: 20px; font-family: 'monospace'; color: ${CYBER.text}; }
        .card { background: ${CYBER.card}; border: 1px solid ${CYBER.border}; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
        .log-container { 
          height: 250px; 
          overflow-y: auto; 
          background: #000; 
          padding: 12px; 
          border: 1px solid ${CYBER.border}; 
          font-size: 11px; 
        }
        .label { font-size: 10px; color: ${CYBER.primary}; letter-spacing: 1px; margin-bottom: 8px; display: block; text-transform: uppercase; }
        .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .cyber-btn {
          width: 100%; padding: 12px; background: none; 
          border: 1px solid ${CYBER.primary}; color: ${CYBER.primary}; 
          cursor: pointer; text-transform: uppercase; margin-top: 10px;
        }
      `}</style>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '24px' }}>NEURAL_PULSE_DEBUG</h1>
        <div style={{ fontSize: '10px', opacity: 0.6 }}>SYSTEM_AUDIT_MODE // v1.2.5</div>
      </div>

      <div className="card">
        <span className="label">Telemetry_Stream</span>
        <div className="log-container" ref={logRef}>
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '4px', color: log.includes('❌') ? CYBER.danger : log.includes('⚠️') ? '#ffaa00' : '' }}>
              {log}
            </div>
          ))}
        </div>
      </div>

      <div className="status-grid">
        <div className="card">
          <span className="label">Resource_Stats</span>
          <div style={{fontSize: '12px'}}>USERS: {data?.totalUsers || '...'}</div>
          <div style={{fontSize: '12px', color: CYBER.success}}>BALANCE: {data?.totalBalance || '0'} NP</div>
        </div>
        <div className="card">
          <span className="label">AdminJS_Snapshot</span>
          <div style={{ fontSize: '10px', opacity: 0.7 }}>
            RES: {resource?.id || 'CORE'}<br/>
            ACT: {action?.name || 'VIEW'}
          </div>
        </div>
      </div>

      <button className="cyber-btn" onClick={async () => {
          addLog("PING: TESTING_SERVER_GATEWAY...");
          try {
            const res = await fetch('/api/admin/command', { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'ping' })
            });
            addLog(`PONG: RESPONSE_${res.status}`);
          } catch (e) {
            addLog(`FAIL: ${e.message}`, 'ERROR');
          }
      }}>
        Execute Diagnostic Ping
      </button>
    </div>
  );
};

export default Dashboard;
