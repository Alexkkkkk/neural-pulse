import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from telebot import TeleBot, types

VERSION = "1.3.6"
BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw"
PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f"
DOMAIN = "neural-pulse.bothost.ru"

app = Flask(__name__, static_folder='static')
CORS(app)
bot = TeleBot(BOT_TOKEN)

def get_db_connection():
    return psycopg2.connect(PG_URI, sslmode='disable')

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            balance NUMERIC DEFAULT 0,
            energy INTEGER DEFAULT 1000,
            click_lvl INTEGER DEFAULT 1,
            pnl NUMERIC DEFAULT 0,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    cur.close()
    conn.close()

init_db()

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/user/<user_id>')
def get_user(user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT * FROM users WHERE user_id = %s', (user_id,))
    user = cur.fetchone()
    if not user:
        cur.execute('INSERT INTO users (user_id) VALUES (%s) RETURNING *', (user_id,))
        user = cur.fetchone()
        conn.commit()
    cur.close()
    conn.close()
    return jsonify(user)

@app.route('/api/save', method=['POST'])
def save_data():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE users SET balance=%s, energy=%s, click_lvl=%s, pnl=%s, last_active=CURRENT_TIMESTAMP 
        WHERE user_id=%s
    ''', (data['balance'], data['energy'], data['click_lvl'], data['pnl'], data['userId']))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"status": "ok"})

@app.route('/api/leaderboard')
def get_leaderboard():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT user_id, balance, pnl FROM users ORDER BY balance DESC LIMIT 15')
    leaders = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(leaders)

@app.route('/api/stats')
def get_stats():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM users')
    count = cur.fetchone()[0]
    cur.close()
    conn.close()
    return jsonify({"users": count})

@bot.message_handler(commands=['start'])
def start(message):
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("⚡ START PULSE", web_app=types.WebAppInfo(url=f"https://{DOMAIN}")))
    bot.send_message(message.chat.id, f"<b>🚀 NEURAL PULSE v{VERSION}</b>\nQuantum synergy active.", parse_mode='HTML', reply_markup=markup)

if __name__ == '__main__':
    import threading
    threading.Thread(target=lambda: bot.infinity_polling(), daemon=True).start()
    app.run(host='0.0.0.0', port=3000)
