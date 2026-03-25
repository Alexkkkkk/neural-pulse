import { v4 as uuidv4 } from 'uuid';

export const logger = {
    info: (msg, meta = '') => console.log(`[${new Date().toLocaleString()}] 🔵 INFO: ${msg}`, meta),
    progress: (step, total) => {
        const percent = Math.round((step / total) * 100);
        const bar = '█'.repeat(step) + '░'.repeat(total - step);
        console.log(`[${new Date().toLocaleString()}] ⚙️ LOADING: [${bar}] ${percent}%`);
    },
    system: (msg) => {
        console.log(`\n` + `═`.repeat(50));
        console.log(`[${new Date().toLocaleString()}] 🚀 SYSTEM: ${msg}`);
        console.log(`═`.repeat(50) + `\n`);
    },
    warn: (msg, meta = '') => console.log(`[${new Date().toLocaleString()}] 🟡 WARN: ${msg}`, meta),
    error: (msg, err) => {
        console.error(`[${new Date().toLocaleString()}] 🔴 ERROR: ${msg}`);
        if (err) console.error("--- Stack Trace Start ---\n", err, "\n--- Stack Trace End ---");
    },
    http: (req, res, next) => {
        const requestId = uuidv4().split('-')[0];
        const start = Date.now();
        if (req.url.startsWith('/api')) {
            res.on('finish', () => {
                const duration = Date.now() - start;
                const statusColor = res.statusCode >= 400 ? '🔴' : '🟢';
                console.log(`[${new Date().toLocaleString()}] ${statusColor} API [${requestId}] ${req.method} ${req.url} ${res.statusCode} | ${duration}ms`);
            });
        }
        next();
    }
};
