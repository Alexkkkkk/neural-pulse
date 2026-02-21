# ... после Step 9 (очистка кэша) ...

# 10. Копируем проект (включая твой новый http_wrapper.py, index.html и папку images)
COPY . .

# 11. Папка для базы данных
RUN mkdir -p /app/data && chmod 777 /app/data

# 12. Открываем порт
EXPOSE 3000

# 13. Запуск
CMD ["python", "http_wrapper.py"]
