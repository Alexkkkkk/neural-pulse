import { Sequelize, DataTypes, Op } from 'sequelize';
import session from 'express-session';
import ConnectSessionSequelize from 'connect-session-sequelize';
import os from 'os';
import cluster from 'cluster'; 

// --- 🌐 CONFIG ---
// Подключение к pghost.ru (SSL отключен для порта 32865 согласно спецификации Bothost)
const PG_URI = "postgresql://bothost_db_db1789af0108:hl3yLh4DQmySkEYDPYwS8fn9xkLPHYNMhmCbU8WCYXs@node1.pghost.ru:32865/bothost_db_db1789af0108";

export const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false,
    dialectOptions: { 
        ssl: false, 
        connectTimeout: 60000 
    },
    pool: { 
        max: 15, 
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
    tableName: 'users',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['username'] },
        { fields: ['wallet'] },
        { fields: ['referred_by'] }
    ]
});

// --- 📋 МОДЕЛЬ: TASK ---
export const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, unique: true },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING, defaultValue: '' },
    icon: { type: DataTypes.STRING, defaultValue: 'Task' }
}, { 
    timestamps: false,
    tableName: 'tasks',
    underscored: true 
});

// --- 📊 МОДЕЛЬ: STATS (Для графиков Dashboard) ---
export const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    active_wallets: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_balance: { type: DataTypes.DECIMAL(24, 2), defaultValue: 0 },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    db_latency: { type: DataTypes.FLOAT }
}, { 
    timestamps: true, 
    tableName: 'stats',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// --- 📈 МОДЕЛЬ: GLOBAL_STATS (Кэш общих данных) ---
export const GlobalStats = sequelize.define('global_stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    total_balance: { 
        type: DataTypes.DECIMAL(32, 2), 
        defaultValue: 0,
        get() { return parseFloat(this.getDataValue('total_balance') || 0); }
    },
    total_users: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { 
    timestamps: false, 
    tableName: 'global_stats',
    underscored: true 
});

// Настройка связей
User.hasMany(User, { as: 'ReferralList', foreignKey: 'referred_by' });
User.belongsTo(User, { as: 'Inviter', foreignKey: 'referred_by' });

// --- 📊 ТЕЛЕМЕТРИЯ ---
export const logSystemStats = async () => {
    // Выполняем только на основном процессе, чтобы не дублировать логи
    const isPrimary = cluster.isPrimary || (cluster.isWorker && cluster.worker.id === 1);
    if (!isPrimary) return;

    try {
        const start = Date.now();
        const [gStats, walletCount] = await Promise.all([
            GlobalStats.findByPk(1),
            User.count({ 
                where: { wallet: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } 
            })
        ]);

        const dbLatency = Date.now() - start;
        const totalBalance = gStats?.total_balance || 0;
        const totalUsers = gStats?.total_users || 0;
        
        // Сбор метрик системы
        const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const cpuCount = os.cpus()?.length || 1;
        const load = ((os.loadavg()[0] / cpuCount) * 100).toFixed(1);

        await Stats.create({
            user_count: totalUsers,
            active_wallets: walletCount,
            total_balance: totalBalance,
            server_load: parseFloat(load),
            mem_usage: parseFloat(mem),
            db_latency: parseFloat(dbLatency)
        });
        
        // Очистка старых данных (храним историю 48 часов)
        await Stats.destroy({
            where: {
                created_at: { [Op.lt]: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
            }
        });
    } catch (e) {
        console.error('▪️ [TELEMETRY] ERROR:', e.message);
    }
};

// --- 🚀 ИНИЦИАЛИЗАЦИЯ ---
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('⚡ [DB] CONNECTED TO POSTGRES (STABLE)');

        const isPrimary = cluster.isPrimary || (cluster.isWorker && cluster.worker.id === 1);

        if (isPrimary) {
            // Синхронизация структуры БД
            await sequelize.sync({ alter: true });
            await sessionStore.sync();
            
            // Инициализация глобальной статистики
            await GlobalStats.findOrCreate({ 
                where: { id: 1 }, 
                defaults: { id: 1, total_balance: 0, total_users: 0 } 
            });

            // Наполнение дефолтными задачами, если таблица пуста
            if (await Task.count() === 0) {
                await Task.bulkCreate([
                    { title: 'Подписаться на Neural Pulse', reward: 5000, url: 'https://t.me/neural_pulse', icon: 'Telegram' },
                    { title: 'Пригласить 3 агентов', reward: 15000, url: '', icon: 'Users' },
                    { title: 'Подключить TON кошелек', reward: 2500, url: '', icon: 'Wallet' }
                ]);
                console.log('▪️ [DB] DEFAULT_TASKS_LOADED');
            }

            // Запуск цикла сбора метрик (каждые 10 секунд)
            setInterval(logSystemStats, 10000); 
            await logSystemStats(); 
        }

        return true;
    } catch (error) {
        console.error('🚨 [DB] CRITICAL ERROR:', error.message);
        throw error;
    }
};

export { Op };
