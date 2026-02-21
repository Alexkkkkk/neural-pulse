# 10. Копируем проект (index.html, папку images и bot/)
COPY . .

# 11. Подготовка папки для базы данных
RUN mkdir -p /app/data && chmod 777 /app/data

# 12. Открываем порт
EXPOSE 3000

# 13. Формируем финальную часть http_wrapper.py (исправлено)
RUN echo '            logger.info("Бот запущен")' >> /app/http_wrapper.py && \
    echo '        except Exception as e:' >> /app/http_wrapper.py && \
    echo '            logger.error(f"Ошибка при запуске бота: {e}", exc_info=True)' >> /app/http_wrapper.py && \
    echo '    # Код ниже выполняется при старте файла' >> /app/http_wrapper.py && \
    echo '    threading.Thread(target=run_bot, daemon=True).start()' >> /app/http_wrapper.py && \
    echo '    logger.info(f"HTTP сервер запущен на порту {port}")' >> /app/http_wrapper.py && \
    echo '    uvicorn.run(app, host="0.0.0.0", port=port, log_level=\"info\")' >> /app/http_wrapper.py

# 14. Финальная команда запуска
CMD ["python", "http_wrapper.py"]
CMD ["python", "bot/main.py"]
