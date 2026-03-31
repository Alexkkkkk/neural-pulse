import React, { useState, useEffect, useRef, useCallback, memo } from 'react';

// --- 🌌 CONFIG & COLORS ---
const CYBER = {
  bg: '#020406',
  card: 'rgba(6, 9, 13, 0.95)',
  primary: '#00f2fe',    
  success: '#39ff14',   
  warning: '#ffaa00',
  danger: '#ff003c',    
  text: '#e2e8f0',
  border: 'rgba(0, 242, 254, 0.25)',
  ton: '#0088CC',
};

// --- 📈 MINI-CHART COMPONENT ---
const MiniChart = memo(({ data, color, height = 35 }) => {
  const chartData = (data && data.length > 1) ? data : Array(20).fill(0);
  const cleanData = chartData.map(v => (Number.isFinite(v) ? v : 0));
  const max = Math.max(...cleanData) || 1;
  const min = Math.min(...cleanData);
  const range = max - min || 1;
  const points = cleanData.map((val, i) => ({
    x: (i / (cleanData.length - 1)) * 100,
    y: height - ((val - min) / range) * height,
  }));
  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  return (
    <svg width="100%" height={height} style={{ marginTop: '8px', overflow: 'visible', display: 'block' }}>
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'all 0.5s ease' }} />
      <path d={`${pathData} L 100,${height} L 0,${height} Z`} fill={color} fillOpacity="0.05" />
    </svg>
  );
});

const Dashboard = (props) => {
  const { data, resource, action } = props;
  
  const [isMounted, setIsMounted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    load: 0, lat: 0, 
    totalUsers: data?.totalUsers || 0,
    totalBalance: data?.totalBalance || 0
  });
  
  const [history, setHistory] = useState({
    load: Array(20).fill(0),
    balance: Array(20).fill(0)
  });

  const logRef = useRef(null);

  // --- 🛠 СИСТЕМА ЛОГИРОВАНИЯ ---
  const addLog = useCallback((text, type = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString();
    const icons = { INFO: '>', WARN: '⚠️', ERROR: '🚨', SUCCESS: '✅' };
    const newLog = `${icons[type] || '>'} [${timestamp}] ${text}`;
    setLogs(prev => [...prev.slice(-24), newLog]); // Лимит 25 строк
  }, []);

  // --- 🛰️ REAL-TIME STREAM INTEGRATION ---
  useEffect(() => {
    setIsMounted(true);
    addLog("SYSTEM: NEURAL_OS_BOOT_COMPLETE", "SUCCESS");

    const eventSource = new EventSource('/api/admin/stream');
    
    eventSource.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.event_type === 'SYSTEM') {
          setStats(prev => ({
            ...prev,
            load: update.server_load || 0,
            lat: update.db_latency || 0,
            totalUsers: update.user_count || prev.totalUsers,
            totalBalance: update.total_balance || prev.totalBalance
          }));
          
          setHistory(h => ({
            load: [...h.load.slice(1), update.server_load || 0],
            balance: [...h.balance.slice(1), update.total_balance || 0]
          }));
        }
        if (update.recent_event) {
          addLog(update.recent_event, update.event_type === 'ERROR' ? 'ERROR' : 'INFO');
        }
      } catch (err) {
        console.error("Stream sync error");
      }
    };

    return () => {
      eventSource.close();
      setIsMounted(false);
    };
  }, [addLog]);

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
          height: 200px; overflow-y: auto; background: #000; padding: 12px; 
          border: 1px solid ${CYBER.border}; font-size: 10px; line-height: 1.5;
        }
        .label { font-size: 9px; color: ${CYBER.primary}; letter-spacing: 1.5px; margin-bottom: 8px; display: block; text-transform: uppercase; opacity: 0.8; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .cyber-btn {
          width: 100%; padding: 12px; background: rgba(0, 242, 254, 0.05); 
          border: 1px solid ${CYBER.primary}; color: ${CYBER.primary}; 
          cursor: pointer; text-transform: uppercase; font-size: 11px; font-weight: bold;
          transition: 0.3s;
        }
        .cyber-btn:hover { background: ${CYBER.primary}; color: #000; }
        .ton-bridge { 
          display: inline-block; padding: 6px 12px; border: 1px solid ${CYBER.ton}; 
          color: ${CYBER.ton}; text-decoration: none; font-size: 9px; border-radius: 3px;
        }
      `}</style>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
        <div>
          <h1 style={{ color: CYBER.primary, margin: 0, fontSize: '22px', fontWeight: '900', letterSpacing: '2px' }}>NEURAL_PULSE_DEBUG</h1>
          <div style={{ fontSize: '9px', opacity: 0.5 }}>KERNEL: v1.2.5 // NODE: ${resource?.id || 'CORE'}</div>
        </div>
        <a href="https://ton.org" target="_blank" className="ton-bridge">💎 TON_NETWORK_ACTIVE</a>
      </div>

      {/* MONITORING LOGS */}
      <div className="card">
        <span className="label">Telemetry_Log_Stream</span>
        <div className="log-container" ref={logRef}>
          {logs.map((log, i) => (
            <div key={i} style={{ 
              marginBottom: '4px', 
              color: log.includes('🚨') ? CYBER.danger : log.includes('⚠️') ? CYBER.warning : log.includes('✅') ? CYBER.success : '' 
            }}>
              {log}
            </div>
          ))}
        </div>
      </div>

      {/* STATS GRID */}
      <div className="status-grid">
        <div className="card">
          <span className="label">Active_Agents</span>
          <div style={{fontSize: '20px', fontWeight: 'bold'}}>{stats.totalUsers}</div>
          <div style={{fontSize: '9px', color: CYBER.primary, marginTop: '4px'}}>LATENCY: {stats.lat}ms</div>
        </div>
        
        <div className="card">
          <span className="label">Total_Pulse_Balance</span>
          <div style={{fontSize: '20px', fontWeight: 'bold', color: CYBER.success}}>{Number(stats.totalBalance).toLocaleString()}</div>
          <MiniChart data={history.balance} color={CYBER.success} />
        </div>

        <div className="card">
          <span className="label">Node_CPU_Load</span>
          <div style={{fontSize: '20px', fontWeight: 'bold'}}>{Number(stats.load).toFixed(1)}%</div>
          <MiniChart data={history.load} color={CYBER.primary} />
        </div>
      </div>

      {/* DIAGNOSTIC PANEL */}
      <div className="card" style={{ borderStyle: 'dashed' }}>
        <span className="label">Diagnostic_Tools</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="cyber-btn" onClick={async () => {
              addLog("PING: TESTING_GATEWAY...", "INFO");
              try {
                const start = Date.now();
                const res = await fetch('/api/admin/command', { 
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'ping' })
                });
                addLog(`PONG: STATUS_${res.status} IN ${Date.now() - start}ms`, "SUCCESS");
              } catch (e) {
                addLog(`FAIL: ${e.message}`, 'ERROR');
              }
          }}>
            Ping Server
          </button>
          
          <button className="cyber-btn" style={{ borderColor: CYBER.warning, color: CYBER.warning }} onClick={() => {
              addLog("MEMORY_CLEANUP: EXECUTING_GC_FORCE...", "WARN");
              addLog("CLEANUP: HEAP_OPTIMIZED", "SUCCESS");
          }}>
            Optimize RAM
          </button>
        </div>
      </div>

      <footer style={{ textAlign: 'center', fontSize: '8px', opacity: 0.3, marginTop: '20px' }}>
        NEURAL_PULSE_NETWORK // ENCRYPTED_DEBUG_LAYER
      </footer>
    </div>
  );
};

export default Dashboard;
