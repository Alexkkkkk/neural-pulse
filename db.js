import { Sequelize, DataTypes } from 'sequelize';
import session from 'express-session';
import ConnectSessionSequelize from 'connect-session-sequelize';
import os from 'os';
import cluster from 'cluster'; // Добавлено для управления воркерами

// URI базы данных (Bothost/PGhost)
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";

export const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false,
    dialectOptions: { 
        ssl: false,
        connectTimeout: 60000 
    },
    pool: { 
        // Суммарно 2 воркера откроют до 20 соединений (оптимально для pghost)
        max: 10, 
        min: 2,  
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

// Модель Пользователя
export const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    username: { type: DataTypes.STRING },
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
    wallet: { type: DataTypes.STRING, allowNull: true },
    last_bonus: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { 
    timestamps: true, 
    underscored: true,
    indexes: [
        { fields: ['username'] },
        { fields: ['wallet'] },
        { fields: ['referred_by'] }
    ]
});

// Модель Задач
export const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, unique: true },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING },
    icon: { type: DataTypes.STRING, defaultValue: 'Task' }
}, { timestamps: false });

// Модель Системной Статистики
export const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_count: { type: DataTypes.INTEGER },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    db_latency: { type: DataTypes.INTEGER }
}, { 
    timestamps: true, 
    tableName: 'stats' 
});

// --- СВЯЗИ ---
User.hasMany(User, { as: 'ReferralList', foreignKey: 'referred_by' });
User.belongsTo(User, { as: 'Inviter', foreignKey: 'referred_by' });

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
export const logSystemStats = async () => {
    // Пишем статистику ТОЛЬКО из Worker 1 (Админка), чтобы не дублировать записи
    if (cluster.isWorker && cluster.worker.id !== 1) return;

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
    } catch (e) {
        console.error('Stats logging error:', e.message);
    }
};

// --- ИНИЦИАЛИЗАЦИЯ ---
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('--- [DB] CONNECTED ---');

        // Синхронизацию и начальные данные делает только Worker 1 (или Master)
        if (!cluster.isWorker || cluster.worker.id === 1) {
            await sequelize.sync({ alter: true });
            console.log('--- [DB] SCHEMA SYNCED ---');

            await sessionStore.sync(); 
            
            const taskCount = await Task.count();
            if (taskCount === 0) {
                await Task.bulkCreate([
                    { title: 'Подписаться на Neural Pulse', reward: 5000, url: 'https://t.me/neural_pulse', icon: 'Telegram' },
                    { title: 'Пригласить 3 агентов', reward: 15000, url: '', icon: 'Users' },
                    { title: 'Подключить TON кошелек', reward: 2500, url: '', icon: 'Wallet' }
                ]);
            }

            // Интервал сбора (раз в 5 минут) запускаем только здесь
            setInterval(logSystemStats, 5 * 60 * 1000);
            await logSystemStats(); // Первый запуск
        }

        return true;
    } catch (error) {
        console.error
