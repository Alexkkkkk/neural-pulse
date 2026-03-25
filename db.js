import { Sequelize, DataTypes } from 'sequelize';
import session from 'express-session';
import ConnectSessionSequelize from 'connect-session-sequelize';

// Твой рабочий URI базы данных
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";

export const sequelize = new Sequelize(PG_URI, { 
    dialect: 'postgres', 
    logging: false,
    dialectOptions: { 
        ssl: false 
    },
    // Настройки пула для предотвращения разрыва соединений на Bothost
    pool: { 
        max: 30, 
        min: 5,
        acquire: 60000,
        idle: 10000 
    },
    timezone: '+00:00' // Гарантирует правильную работу с датами
});

const SequelizeStore = ConnectSessionSequelize(session.Store);
export const sessionStore = new SequelizeStore({ 
    db: sequelize,
    tableName: 'sessions' 
});

// --- МОДЕЛЬ: АГЕНТЫ (USER) ---
export const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    username: { type: DataTypes.STRING, index: true },
    photo_url: { type: DataTypes.TEXT },
    
    // Экономика токена
    balance: { type: DataTypes.DECIMAL(20, 2), defaultValue: 0 }, 
    profit: { type: DataTypes.DECIMAL(20, 2), defaultValue: 0 },  
    
    // Игровые механики
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    
    // Уровни прокачки
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    tap_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    mine_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    energy_lvl: { type: DataTypes.INTEGER, defaultValue: 1 },
    
    // Социалка и Квесты
    referrals: { type: DataTypes.INTEGER, defaultValue: 0 },
    referred_by: { type: DataTypes.BIGINT, allowNull: true },
    completed_tasks: { type: DataTypes.JSONB, defaultValue: [] },
    
    // Web3 данные
    wallet: { type: DataTypes.STRING, allowNull: true, index: true },
    
    // Активность
    last_bonus: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { 
    timestamps: true,
    underscored: true // created_at вместо createdAt
});

// --- МОДЕЛЬ: МИССИИ (TASK) ---
export const Task = sequelize.define('tasks', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, unique: true },
    reward: { type: DataTypes.INTEGER, defaultValue: 1000 },
    url: { type: DataTypes.STRING },
    icon: { type: DataTypes.STRING, defaultValue: 'Task' }
}, { timestamps: false });

// --- МОДЕЛЬ: ТЕЛЕМЕТРИЯ (STATS) ---
export const Stats = sequelize.define('stats', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_count: { type: DataTypes.INTEGER },
    server_load: { type: DataTypes.FLOAT },
    mem_usage: { type: DataTypes.FLOAT },
    db_latency: { type: DataTypes.INTEGER },
    timestamp: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { 
    timestamps: false,
    tableName: 'system_stats'
});

// Связь для реферальной системы
User.hasMany(User, { as: 'Referrals', foreignKey: 'referred_by' });

// Функция инициализации
export const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('--- [DB] CONNECTED TO POSTGRES ---');
        
        // ВНИМАНИЕ: force: true полностью ПЕРЕСОЗДАСТ таблицы.
        // Это уберет ошибку "created_at contains null values", удалив старые проблемные записи.
        await sequelize.sync({ force: true }); 
        console.log('--- [DB] TABLES RE-CREATED (FORCE SUCCESS) ---');

        // Сразу создаем базовые задания, чтобы проект не был пустым
        await Task.bulkCreate([
            { title: 'Подписаться на Neural Pulse', reward: 5000, url: 'https://t.me/neural_pulse', icon: 'Telegram' },
            { title: 'Пригласить 3 агентов', reward: 15000, url: '', icon: 'Users' },
            { title: 'Подключить TON кошелек', reward: 2500, url: '', icon: 'Wallet' }
        ], { ignoreDuplicates: true });

        return true;
    } catch (error) {
        console.error('--- [DB] FATAL INIT ERROR:', error);
        return false;
    }
};
