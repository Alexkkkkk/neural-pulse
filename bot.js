import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Sequelize, DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const BOT_TOKEN = "8745333905:AAFd9lupbNYDSTAjboN3o-vMYZlv5b_YXtA";
const PG_URI = "postgresql://bothost_db_130943b4f3f6:oY6CieQ5aohyTLgU9i23M6w80naZt9_1mJ4V6roejTs@node1.pghost.ru:32834/bothost_db_130943b4f3f6";
const DOMAIN = "https://np.bothost.tech"; 
const PORT = 3000; // API будет тут

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const sequelize = new Sequelize(PG_URI, { dialect: 'postgres', logging: false, dialectOptions: { ssl: false } });

// --- MODELS ---
const User = sequelize.define('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    username: { type: DataTypes.STRING },
    photo_url: { type: DataTypes.TEXT },
    balance: { type: DataTypes.DOUBLE, defaultValue: 0 },
    energy: { type: DataTypes.DOUBLE, defaultValue: 1000 },
    max_energy: { type: DataTypes.INTEGER, defaultValue: 1000 },
    tap: { type: DataTypes.INTEGER, defaultValue: 1 },
    profit: { type: DataTypes.DOUBLE, defaultValue: 0 }, 
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    last_seen: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { timestamps: true });

// --- MIDDLEWARES ---
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// --- API ---
app.get('/api/user/:id', async (req, res) => {
    try {
        const userId = BigInt(req.params.id);
        let user = await User.findByPk(userId);
        if (!user) user = await User.create({ id: userId, username: req.query.username || 'AGENT' });
        res.json(user);
    } catch (e) { res.status(500).send("ERROR"); }
});

app.post('/api/save', async (req, res) => {
    try {
        const { id, ...data } = req.body;
        await User.update({ ...data, last_seen: new Date() }, { where: { id: BigInt(id) } });
        res.json({ ok: true });
    } catch (e) { res.status(500).send("ERROR"); }
});

// --- TELEGRAM ---
bot.start(async (ctx) => {
    const logoPath = path.join(__dirname, 'static/images/logo.png');
    ctx.replyWithPhoto({ source: logoPath }, {
        caption: `<b>Neural Pulse</b>\nАгент: <code>${ctx.from.username || ctx.from.id}</code>`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp("⚡ ВХОД", DOMAIN)]])
    });
});

app.use(bot.webhookCallback(`/telegraf/${BOT_TOKEN}`));

sequelize.sync().then(() => {
    bot.telegram.setWebhook(`${DOMAIN}/telegraf/${BOT_TOKEN}`);
    app.listen(PORT, () => console.log(`🚀 BOT & API ONLINE: PORT ${PORT}`));
});
