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
        max: 15, 
        min: 5,  
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

// --- 📊 МОДЕЛЬ: STATS (История для графиков) ---
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
    underscored: false 
});

// --- 📈 МОДЕЛЬ: GLOBAL_STATS (Таблица-агрегатор для триггеров) ---
export const GlobalStats = sequelize.define('global_stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    total_balance: { type: DataTypes.DECIMAL(32, 2), defaultValue: 0 },
    total_users: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { 
    timestamps: false, 
    tableName: 'global_stats',
    underscored: true 
});

// --- 🔗 СВЯЗИ ---
User.hasMany(User, { as: 'ReferralList', foreignKey: 'referred_by' });
User.belongsTo(User, { as: 'Inviter', foreignKey: 'referred_by' });

// --- 📊 СБОР ТЕЛЕМЕТРИИ ---
export const logSystemStats = async () => {
    // Выполняем только на главном процессе
    const isPrimary = cluster.isMaster || (cluster.isWorker && cluster.worker.id === 1);
    if (!isPrimary) return;

    try {
        const start = Date.now();
        
        // Получаем актуальные данные из агрегатора GlobalStats (куда пишут триггеры)
        const gStats = await GlobalStats.findByPk(1);
        const totalBalance = gStats ? parseFloat(gStats.total_balance) : 0;
        const totalUsers = gStats ? gStats.total_users : 0;

        const walletCount = await User.count({ 
            where: { wallet: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } 
        });

        const latency = Date.now() - start;
        const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const cpuCount = os.cpus().length;
        const load = ((os.loadavg()[0] / cpuCount) * 100).toFixed(1);

        // Создаем запись в истории статистики
        await Stats.create({
            user_count: totalUsers,
            active_wallets: walletCount,
            total_balance: totalBalance,
            server_load: parseFloat(load),
            mem_usage: parseFloat(mem),
            db_latency: parseFloat(latency)
        });
        
        // Очистка старых данных: храним только 288 записей (24 часа)
        const totalCount = await Stats.count();
        if (totalCount > 288) {
            const oldestToKeep = await Stats.findOne({
                offset: totalCount - 288,
                order: [['id', 'ASC']]
            });
            if (oldestToKeep) {
                await Stats.destroy({ where: { id: { [Op.lt]: oldestToKeep.id } } });
            }
        }
        console.log(`--- [TELEMETRY] Sync Successful | Users: ${totalUsers} | Balance: ${totalBalance}`);
    } catch (e) {
        console.error('--- [TELEMETRY] ERROR:', e.message);
    }
};

// --- 🚀 ИНИЦИАЛИЗАЦИЯ ---
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('--- [DB] CONNECTED TO POSTGRES ---');

        const isPrimary = cluster.isMaster || (cluster.isWorker && cluster.worker.id === 1);

        if (isPrimary) {
            // 1. Синхронизируем служебные таблицы
            await GlobalStats.sync({ alter: true });
            await Stats.sync({ alter: true });
            
            // 2. Синхронизируем таблицу User БЕЗ alter: true (критично для триггеров!)
            await User.sync(); 
            
            await Task.sync({ alter: true });
            
            // Финальная безопасная синхронизация всей остальной схемы
            await sequelize.sync(); 
            
            // 3. Инициализация агрегатора (ID 1), если строка отсутствует
            await GlobalStats.findOrCreate({ 
                where: { id: 1 }, 
                defaults: { total_balance: 0, total_users: 0 } 
            });

            await sessionStore.sync(); 
            
            // 4. Проверка и создание стандартных задач
            const taskCount = await Task.count();
            if (taskCount === 0) {
                await Task.bulkCreate([
                    { title: 'Подписаться на Neural Pulse', reward: 5000, url: 'https://t.me/neural_pulse', icon: 'Telegram' },
                    { title: 'Пригласить 3 агентов', reward: 15000, url: '', icon: 'Users' },
                    { title: 'Подключить TON кошелек', reward: 2500, url: '', icon: 'Wallet' }
                ]);
                console.log('--- [DB] Default Tasks Created ---');
            }

            // Запуск цикла сбора телеметрии каждые 5 минут
            setInterval(logSystemStats, 5 * 60 * 1000);
            await logSystemStats(); 
        }

        return true;
    } catch (error) {
        console.error('--- [DB] CRITICAL ERROR:', error.message);
        throw error;
    }
};

export { Op };
