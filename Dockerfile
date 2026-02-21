# ... после Step 9 (очистка кэша) ...

# 10. Копируем проект (включая твой новый http_wrapper.py, index.html и папку images)
COPY . .

# 11. Папка для базы данных
RUN mkdir -p /app/data && chmod 777 /app/data

# 12. Открываем порт
EXPOSE 3000

# 13. Запуск
CMD ["python", "http_wrapper.py"]
# ... продолжение после твоего последнего echo ...
    echo '    threading.Thread(target=run_bot, daemon=True).start()' >> /app/http_wrapper.py && \
    echo '    logger.info(f"HTTP сервер запущен на порту {port}")' >> /app/http_wrapper.py && \
    echo '    uvicorn.run(app, host="0.0.0.0", port=port, log_level=\"info\")' >> /app/http_wrapper.py
   echo '            logger.error(f"Ошибка при запуске бота: {e}", exc_info=True)' >> /app/http_wrapper.py && \
    echo '    # Запуск бота в отдельном потоке' >> /app/http_wrapper.py && \
    echo '    threading.Thread(target=run_bot, daemon=True).start()' >> /app/http_wrapper.py && \
    echo '    logger.info(f"HTTP сервер запускается на порту {port}")' >> /app/http_wrapper.py && \
    echo '    uvicorn.run(app, host="0.0.0.0", port=port, log_level=\"info\")' >> /app/http_wrapper.py
