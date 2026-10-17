FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt requirements.lock ./
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY . ./

EXPOSE 8000

CMD ["python", "local_http_server.py", "--host", "0.0.0.0", "--port", "8000"]
