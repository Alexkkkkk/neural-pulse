FROM python:3.10-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN mkdir -p /app/data /app/static
COPY . .
RUN chmod 777 /app/data
EXPOSE 3000
CMD ["python", "main.py"]
