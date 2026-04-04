import { Sequelize, DataTypes, Op } from 'sequelize';
import session from 'express-session';
import ConnectSessionSequelize from 'connect-session-sequelize';
import os from 'os';
import cluster from 'cluster'; 
import 'dotenv/config';

// --- 🌐 CONFIG ---
const PG_URI = process.env.DATABASE_URL;

export const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false,
    dialectOptions: { 
        ssl: false,
        connectTimeout: 60000 
    },
    pool: { 
        max: parseInt(process.env.DB_MAX_POOL || '35'), 
        min: 10,  
        acquire: 60000, 
        idle: 10000 
    },
    timezone: '+00:00'
});

const SequelizeStore = ConnectSessionSequelize(session.Store);
export const sessionStore = new SequelizeStore({ 
    db: sequelize, 
    tableName: 'sessions' 
});

// --- 👤 МОДЕЛЬ: USER ---
export const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    username: { type: DataTypes.STRING, defaultValue: 'AGENT' },
    photo_url: { type: DataTypes.TEXT },
    balance: { 
        type: DataTypes.DECIMAL(20, 2), 
        defaultValue: 0,
        get() { return parseFloat(this.getDataValue('balance') || 0); } 
    },
    profit: { 
        type: DataTypes.DECIMAL(20, 2), 
        defaultValue: 0,
        get() { return parseFloat(this.getDataValue('profit') || 0); }
    },
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
    referred_by: { type: DataTypes.BIGINT, allowNull: true },
    completed_tasks: { type: DataTypes.JSONB, defaultValue: [] },
    wallet: { type: DataTypes.STRING, allowNull: true },
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { 
    timestamps: true, 
    underscored: true, 
    tableName: 'users'
});

// --- 📋 МОДЕЛЬ: TASK ---
export const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, unique: true },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING, defaultValue: '' },
    icon: { type: DataTypes.STRING, defaultValue: 'Task' }
}, { timestamps: false, tableName: 'tasks', underscored: true });

// --- 📈 МОДЕЛЬ: GLOBAL_STATS ---
export const GlobalStats = sequelize.define('global_stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    total_users: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_balance: { type: DataTypes.DECIMAL(32, 2), defaultValue: 0 }
}, { timestamps: false, tableName: 'global_stats' });

// --- 📊 МОДЕЛЬ: STATS (Логи нагрузки) ---
export const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    db_latency: { type: DataTypes.FLOAT }
}, { timestamps: true, tableName: 'stats', underscored: true });

// СВЯЗИ
User.hasMany(User, { as: 'ReferralList', foreignKey: 'referred_by' });

// ХУКИ
User.afterCreate(async () => {
    try {
        await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { id: 1 } });
        await GlobalStats.increment('total_users', { where: { id: 1 }, by: 1 });
    } catch (e) { console.error('▪️ [DB] Hook Error:', e.message); }
});

// ТЕЛЕМЕТРИЯ
export const logSystemStats = async () => {
    const isPrimary = cluster.isPrimary || (cluster.worker && cluster.worker.id === 1);
    if (!isPrimary) return;
    try {
        const start = Date.now();
        const gStats = await GlobalStats.findByPk(1);
        const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const load = ((os.loadavg()[0] / os.cpus().length) * 100).toFixed(1);

        await Stats.create({
            user_count: gStats?.total_users || 0,
            server_load: parseFloat(load),
            mem_usage: parseFloat(mem),
            db_latency: Date.now() - start
        });
    } catch (e) { console.error('▪️ [TELEMETRY] Error:', e.message); }
};

// ИНИЦИАЛИЗАЦИЯ
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('⚡ [DB] SYSTEM ONLINE');
        
        const isPrimary = cluster.isPrimary || (cluster.worker && cluster.worker.id === 1);
        if (isPrimary) {
            await sequelize.sync({ alter: true });
            await sessionStore.sync();
            await GlobalStats.findOrCreate({ where: { id: 1 }, defaults: { id: 1, total_users: 0 } });
            
            if (await Task.count() === 0) {
                await Task.bulkCreate([
                    { title: 'Подписаться на Neural Pulse', reward: 5000, url: 'https://t.me/neural_pulse', icon: 'Telegram' },
                    { title: 'Пригласить 3 агентов', reward: 15000, url: '', icon: 'Users' }
                ]);
            }
            setInterval(logSystemStats, 30000);
        }
        return true;
    } catch (e) {
        console.error('🚨 [DB] CRITICAL:', e.message);
        throw e;
    }
};

export { Op };
