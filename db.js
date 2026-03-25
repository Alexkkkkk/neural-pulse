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
    pool: { 
        max: 30, 
        min: 5,
        acquire: 30000,
        idle: 10000 
    }
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
    underscored: true // Это создает колонки created_at и updated_at
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
        
        // ВНИМАНИЕ: force: true полностью ПЕРЕСОЗДАСТ таблицы (удалит старых юзеров)
        // Это исправит ошибку "column created_at contains null values"
        await sequelize.sync({ force: true }); 
        
        console.log('--- DATABASE RE-INITIALIZED (FORCE) ---');
        return true;
    } catch (error) {
        console.error('Database Init Error:', error);
        return false;
    }
};
