const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '../../../data/game.db');

async function getDB() {
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, balance REAL, click_lvl INTEGER, 
        pnl REAL DEFAULT 0, energy REAL, max_energy INTEGER, 
        level INTEGER DEFAULT 1, last_active INTEGER)`);
    return db;
}

exports.getBalance = async (req, res) => {
    const db = await getDB();
    const userId = req.params.userId;
    const now = Math.floor(Date.now() / 1000);

    let user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (user) {
        const offTime = Math.min(now - (user.last_active || now), 10800);
        const earned = (user.pnl / 3600) * offTime;
        res.json({ status: "ok", data: {
            score: user.balance + earned, tap_power: user.click_lvl,
            pnl: user.pnl, energy: user.energy, level: user.level,
            max_energy: user.max_energy, multiplier: 1
        }});
    } else {
        await db.run(`INSERT INTO users (id, balance, click_lvl, pnl, energy, max_energy, level, last_active) 
                      VALUES (?, 1000, 1, 0, 1000, 1000, 1, ?)`, [userId, now]);
        res.json({ status: "ok", data: { score: 1000, tap_power: 1, pnl: 0, energy: 1000, max_energy: 1000, level: 1, multiplier: 1 }});
    }
};

exports.saveState = async (req, res) => {
    const db = await getDB();
    const d = req.body;
    const now = Math.floor(Date.now() / 1000);

    if (!d.user_id || d.user_id === "guest") return res.json({status: "ignored"});

    await db.run(`UPDATE users SET balance=?, click_lvl=?, pnl=?, energy=?, level=?, last_active=? WHERE id=?`,
        [d.score, d.tap_power, d.pnl, d.energy, d.level, now, d.user_id]);
    
    res.json({status: "ok"});
};
