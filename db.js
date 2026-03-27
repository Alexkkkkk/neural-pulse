import { Sequelize, DataTypes } from 'sequelize';
import session from 'express-session';
import ConnectSessionSequelize from 'connect-session-sequelize';
import os from 'os';

const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";

export const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false,
    dialectOptions: { ssl: false },
    pool: { 
        max: 5, 
        min: 0, 
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

// --- МОДЕЛИ ---
export const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    username: { type: DataTypes.STRING, index: true },
    photo_url: { type: DataTypes.TEXT },
    balance: { type: DataTypes.DECIMAL(20, 2), defaultValue: 0 }, 
    profit: { type: DataTypes.DECIMAL(20, 2), defaultValue: 0 },  
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
    referred_by: { type: DataTypes.BIGINT, allowNull: true },
    completed_tasks: { type: DataTypes.JSONB, defaultValue: [] },
    wallet: { type: DataTypes.STRING, allowNull: true, index: true },
    last_bonus: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: true, underscored: true });

export const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, unique: true },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING },
    icon: { type: DataTypes.STRING, defaultValue: 'Task' }
}, { timestamps: false });

export const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_count: { type: DataTypes.INTEGER },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    db_latency: { type: DataTypes.INTEGER },
    timestamp: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: false, tableName: 'system_stats' });

User.hasMany(User, { as: 'Referrals', foreignKey: 'referred_by' });

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
export const logSystemStats = async () => {
    try {
        const start = Date.now();
        const userCount = await User.count();
        const latency = Date.now() - start;
        const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const load = (os.loadavg()[0] * 10).toFixed(2);

        await Stats.create({
            user_count: userCount,
            server_load: parseFloat(load),
            mem_usage: parseFloat(mem),
            db_latency: latency
        });
    } catch (e) { /* Игнорируем ошибки при старте */ }
};

// --- ИНИЦИАЛИЗАЦИЯ (БЕЗОПАСНАЯ) ---
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('--- [DB] CONNECTED ---');

        // ВМЕСТО HARD WIPE ИСПОЛЬЗУЕМ alter: true
        // Это обновит таблицы без удаления данных пользователей
        await sequelize.sync({ alter: true });
        console.log('--- [DB] SCHEMA SYNCED (SAFE MODE) ---');

        await sessionStore.sync(); 
        
        // Проверяем, есть ли уже задачи в базе, чтобы не дублировать их
        const taskCount = await Task.count();
        if (taskCount === 0) {
            await Task.bulkCreate([
                { title: 'Подписаться на Neural Pulse', reward: 5000, url: 'https://t.me/neural_pulse', icon: 'Telegram' },
                { title: 'Пригласить 3 агентов', reward: 15000, url: '', icon: 'Users' },
                { title: 'Подключить TON кошелек', reward: 2500, url: '', icon: 'Wallet' }
            ]);
            console.log('--- [DB] INITIAL TASKS CREATED ---');
        }

        setInterval(logSystemStats, 5 * 60 * 1000);
        return true;
    } catch (error) {
        console.error('--- [DB] FATAL INIT ERROR:', error);
        return false;
    }
};
