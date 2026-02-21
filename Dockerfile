# ... (твои предыдущие шаги установки aiogram) ...

# 10. Копируем всё содержимое (включая твой новый http_wrapper.py)
COPY . .

# 11. Подготовка данных
RUN mkdir -p /app/data && chmod 777 /app/data

# 12. Запуск через обертку
EXPOSE 3000
CMD ["python", "http_wrapper.py"]
