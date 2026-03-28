import { Sequelize, DataTypes, Op } from 'sequelize';
import session from 'express-session';
import ConnectSessionSequelize from 'connect-session-sequelize';
import os from 'os';
import cluster from 'cluster'; 

// --- 🌐 CONFIG ---
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";

export const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false,
    dialectOptions: { 
        ssl: false, 
        connectTimeout: 60000 
    },
    pool: { 
        max: 8, 
        min: 1,  
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
}, { timestamps: false });

// --- 📊 МОДЕЛЬ: STATS (Для временных графиков в каждом окошке) ---
export const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    active_wallets: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_balance: { type: DataTypes.FLOAT, defaultValue: 0 },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    db_latency: { type: DataTypes.INTEGER }
}, { 
    timestamps: true, 
    tableName: 'stats' 
});

// --- 🔗 СВЯЗИ ---
User.hasMany(User, { as: 'ReferralList', foreignKey: 'referred_by' });
User.belongsTo(User, { as: 'Inviter', foreignKey: 'referred_by' });

// --- 📊 СБОР ТЕЛЕМЕТРИИ ---
export const logSystemStats = async () => {
    // Выполняем только на основном процессе
    const isPrimary = cluster.isMaster || (cluster.isWorker && cluster.worker.id === 1);
    if (!isPrimary) return;

    try {
        const start = Date.now();
        
        // Параллельный сбор данных для скорости
        const [userCount, walletCount, sumBalance] = await Promise.all([
            User.count(),
            User.count({ where: { wallet: { [Op.ne]: null } } }),
            User.sum('balance')
        ]);

        const latency = Date.now() - start;
        const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const load = (os.loadavg()[0] * 10).toFixed(2);

        // Создаем точку на графике
        await Stats.create({
            user_count: userCount,
            active_wallets: walletCount,
            total_balance: parseFloat(sumBalance || 0),
            server_load: parseFloat(load),
            mem_usage: parseFloat(mem),
            db_latency: latency
        });
        
        // Храним последние 96 точек (это ровно 24 часа при интервале в 15 минут)
        const count = await Stats.count();
        if (count > 96) {
            const first = await Stats.findOne({ order: [['id', 'ASC']] });
            if (first) {
                await Stats.destroy({ 
                    where: { id: { [Op.lte]: first.id + (count - 96) } } 
                });
            }
        }
        console.log(`--- [STATS] 15m Snapshot captured. Users: ${userCount}, Wallets: ${walletCount}`);
    } catch (e) {
        console.error('--- [STATS] LOGGING ERROR:', e.message);
    }
};

// --- 🚀 ИНИЦИАЛИЗАЦИЯ ---
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('--- [DB] CONNECTION ESTABLISHED ---');

        const isPrimary = cluster.isMaster || (cluster.isWorker && cluster.worker.id === 1);

        if (isPrimary) {
            // Синхронизируем структуру (добавит новые поля для графиков автоматически)
            await sequelize.sync({ alter: true });
            console.log('--- [DB] SCHEMA SYNCHRONIZED ---');

            await sessionStore.sync(); 
            
            const taskCount = await Task.count();
            if (taskCount === 0) {
                await Task.bulkCreate([
                    { title: 'Подписаться на Neural Pulse', reward: 5000, url: 'https://t.me/neural_pulse', icon: 'Telegram' },
                    { title: 'Пригласить 3 агентов', reward: 15000, url: '', icon: 'Users' },
                    { title: 'Подключить TON кошелек', reward: 2500, url: '', icon: 'Wallet' }
                ]);
                console.log('--- [DB] DEFAULT TASKS CREATED ---');
            }

            // Устанавливаем интервал ровно в 15 минут
            setInterval(logSystemStats, 15 * 60 * 1000);
            await logSystemStats(); // Первый запуск сразу при старте
        }

        return true;
    } catch (error) {
        console.error('--- [DB] CRITICAL ERROR during init:', error.message);
        throw error;
    }
};

export { Op };
