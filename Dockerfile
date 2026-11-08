FROM python:3.13-slim
WORKDIR /app
COPY requirements-foundation.lock requirements-cloud.lock ./
RUN pip install --no-cache-dir -r requirements-cloud.lock
COPY liferaft/ liferaft/
USER 10001
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-10000} --workers 1 --threads 4 --timeout 20 'liferaft.cloud_api:from_environment()'"]
