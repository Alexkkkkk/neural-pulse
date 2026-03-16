from flask import Flask, request, jsonify, send_from_directory
from telebot import TeleBot, types
import psycopg2
from psycopg2.extras import RealDictCursor
import os

# Конфигурация
BOT_TOKEN = "8745333905:AAGTuUyJmU2oHp5FXH98ky6IhP3jmAOttjw"
PG_URI = "postgresql://bothost_db_4405eff8747f:xqUdDdjCZViF1FqeU9jiWMqyd69boOTjHtHvjlcDmeM@node1.pghost.ru:32820/bothost_db_4405eff8747f"

app = Flask(__name__, static_folder='static')
bot = TeleBot(BOT_TOKEN)

def get_db_connection():
    return psycopg2.connect(PG_URI, cursor_factory=RealDictCursor)

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, 
            username TEXT,
            balance NUMERIC DEFAULT 0,
            energy INTEGER DEFAULT 1000,
            max_energy INTEGER DEFAULT 1000,
            click_lvl INTEGER DEFAULT 1,
            wallet_addr TEXT
        )
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("Build 2.4.0 - Database Synced & Ready")

init_db()

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/api/user/<user_id>')
def get_user(user_id):
    name = request.args.get('name', 'Agent')
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
    user = cur.fetchone()
    
    if not user:
        cur.execute(
            "INSERT INTO users (user_id, username) VALUES (%s, %s) RETURNING *",
            (user_id, name)
        )
        user = cur.fetchone()
        conn.commit()
    
    cur.close()
    conn.close()
    return jsonify(user)

@app.route('/api/save', list=['POST']) # В Flask используется methods=['POST']
@app.route('/api/save', methods=['POST'])
def save_user():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users 
        SET balance=%s, energy=%s, click_lvl=%s, wallet_addr=%s 
        WHERE user_id=%s
    """, (data['balance'], data['energy'], data['click_lvl'], data['wallet'], data['userId']))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"ok": True})

@bot.message_handler(commands=['start'])
def start(message):
    markup = types.InlineKeyboardMarkup()
    web_app = types.WebAppInfo("https://neural-pulse.bothost.ru")
    btn = types.InlineKeyboardButton("OPEN TERMINAL", web_app=web_app)
    markup.add(btn)
    bot.reply_to(message, "<b>Neural Pulse v2.4.0</b>\nNode synchronized with Database.", parse_mode="HTML", reply_markup=markup)

if __name__ == '__main__':
    # Запуск бота в неблокирующем режиме для работы Flask
    bot.remove_webhook()
    from threading import Thread
    Thread(target=lambda: bot.infinity_polling()).start()
    app.run(host='0.0.0.0', port=3000)
