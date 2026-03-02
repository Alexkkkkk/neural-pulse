@app.get("/api/leaderboard")
async def get_leaderboard():
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            # Выбираем топ-10 по балансу
            cursor = conn.execute("""
                SELECT id, balance, last_active 
                FROM users 
                ORDER BY balance DESC 
                LIMIT 10
            """)
            rows = cursor.fetchall()
            
            leaderboard = []
            for i, row in enumerate(rows):
                leaderboard.append({
                    "rank": i + 1,
                    "user_id": row["id"],
                    "balance": row["balance"],
                    "is_online": (time.time() - row["last_active"]) < 300  # Онлайн, если был активен последние 5 минут
                })
            
            logger.info("🏆 Запрошена таблица лидеров")
            return {"status": "ok", "data": leaderboard}
    except Exception as e:
        logger.error(f"❌ Ошибка лидерборда: {e}")
        return {"status": "error"}
