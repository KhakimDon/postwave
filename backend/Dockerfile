FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Папка для загруженных медиа (монтируется как volume в compose).
RUN mkdir -p /app/uploads /data

EXPOSE 8000

# Один воркер — фоновый scheduler-поток не должен дублироваться.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
