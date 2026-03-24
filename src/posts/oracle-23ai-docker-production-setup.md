---
layout: post.njk
title: "Running Oracle 23ai in Docker: A Production-Ready Setup"
description: "Everything you need to run Oracle Database 23ai in Docker from choosing the right image to persistent storage, Docker Compose, health checks, networking, backups, and connecting your application."
date: 2025-02-12
author: Oracle 23ai Help Team
readTime: 14 min
tag: DevOps
category: blog
tags:
  - posts
  - docker
  - devops
  - installation
templateEngineOverride: md
---

## Why Docker for Oracle 23ai?

Running Oracle 23ai in Docker is the fastest way to get a fully featured database instance running on any machine — including macOS (Apple Silicon), Windows, and Linux — without a manual install. You get a consistent, reproducible environment that you can spin up in under two minutes, tear down cleanly, and version-control alongside your application code.

There are two official image sources:

| Source | Image | Notes |
|--------|-------|-------|
| Oracle Container Registry | `container-registry.oracle.com/database/free:latest` | Official Oracle image, requires free Oracle account login |
| Gerald Venzl (community) | `gvenzl/oracle-free:23-slim` | No login required, widely used, multiple size variants |

This guide uses the `gvenzl/oracle-free` images — they require no registry login, start faster, and are the most widely adopted approach in the community.

---

## Choosing the Right Image

The `gvenzl/oracle-free` repository offers four variants:

| Image | Size | Startup time | Best for |
|-------|------|-------------|---------|
| `gvenzl/oracle-free:23-slim` | ~1.5 GB | ~90 seconds | Development, CI/CD pipelines |
| `gvenzl/oracle-free:23` | ~3 GB | ~90 seconds | Standard tools included |
| `gvenzl/oracle-free:23-full` | ~5 GB | ~90 seconds | All Oracle components |
| `gvenzl/oracle-free:23-slim-faststart` | ~4.6 GB | ~10 seconds | Local dev where fast restart matters |

The `faststart` variants contain a pre-built database — they are larger to pull but start almost instantly after the first run. For CI/CD pipelines where cold start time matters, `faststart` is worth the larger image size.

> **Note:** If you need Oracle Multilingual Engine (MLE) for JavaScript stored procedures, use the non-slim variants — MLE is not included in the slim images.

---

## Quick Start

Pull and run the slim image:

```bash
docker pull gvenzl/oracle-free:23-slim

docker run -d \
  --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1# \
  gvenzl/oracle-free:23-slim
```

Monitor the startup:

```bash
docker logs -f oracle23ai
```

Wait for this line before attempting to connect:

```
DATABASE IS READY TO USE!
```

Connect immediately:

```bash
docker exec -it oracle23ai sqlplus / as sysdba
```

---

## Production-Ready Setup with Docker Compose

For anything beyond a quick test, use Docker Compose. It captures all your configuration in a single file, makes startup and teardown one command, and integrates cleanly into a multi-service application stack.

Create a `docker-compose.yml` in your project root:

```yaml
version: "3.8"

services:
  oracle:
    image: gvenzl/oracle-free:23-slim
    container_name: oracle23ai
    restart: unless-stopped
    ports:
      - "1521:1521"
    environment:
      ORACLE_PASSWORD: ${ORACLE_PASSWORD:-StrongPass1#}
      ORACLE_DATABASE: APPDB
    volumes:
      - oracle-data:/opt/oracle/oradata
      - ./init-scripts:/container-entrypoint-initdb.d
    healthcheck:
      test: ["CMD", "sqlplus", "-L", "system/${ORACLE_PASSWORD:-StrongPass1#}@//localhost:1521/FREEPDB1", "@/dev/null"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 120s
    shm_size: 1g
    mem_limit: 3g
    cpus: "2"

volumes:
  oracle-data:
    driver: local
```

Start the stack:

```bash
docker compose up -d
docker compose logs -f oracle
```

Stop and clean up (data is preserved in the volume):

```bash
docker compose down
```

Destroy everything including data:

```bash
docker compose down -v
```

---

## Persistent Storage

Without a volume, all your data is lost when the container stops. Always mount a named volume or a host directory to `/opt/oracle/oradata`:

```bash
# Named volume (recommended — Docker manages the location)
docker volume create oracle-data

docker run -d \
  --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1# \
  -v oracle-data:/opt/oracle/oradata \
  gvenzl/oracle-free:23-slim
```

```bash
# Host directory mount (useful when you need direct file access)
mkdir -p ~/oracle-data

docker run -d \
  --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1# \
  -v ~/oracle-data:/opt/oracle/oradata \
  gvenzl/oracle-free:23-slim
```

> When using a host directory on Linux, the directory must be writable by uid `54321` (the oracle user inside the container):
> ```bash
> sudo chown -R 54321:54321 ~/oracle-data
> ```

---

## Automatic Database and User Initialization

The `gvenzl/oracle-free` images support initialization scripts. Any `.sql` or `.sh` file placed in `/container-entrypoint-initdb.d` inside the container runs automatically on first startup — after the database is created but before it is marked ready.

Create an `init-scripts/` folder in your project and add your setup SQL:

```bash
mkdir init-scripts
```

`init-scripts/01_create_user.sql`:

```sql
-- Connect to FREEPDB1 and create application user
ALTER SESSION SET CONTAINER = FREEPDB1;

CREATE USER appuser IDENTIFIED BY AppPass1#;
GRANT DB_DEVELOPER_ROLE TO appuser;
GRANT UNLIMITED TABLESPACE TO appuser;
GRANT CREATE SESSION TO appuser;
```

`init-scripts/02_create_schema.sql`:

```sql
ALTER SESSION SET CONTAINER = FREEPDB1;

-- Create tables
CREATE TABLE appuser.products (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR2(200) NOT NULL,
  description CLOB,
  embedding   VECTOR(1536),
  created_at  TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- Create vector index for semantic search
CREATE VECTOR INDEX products_vec_idx ON appuser.products (embedding)
  ORGANIZATION INMEMORY NEIGHBOR GRAPH
  DISTANCE COSINE
  WITH TARGET ACCURACY 95;
```

Mount the folder in your `docker run` command:

```bash
docker run -d \
  --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1# \
  -v oracle-data:/opt/oracle/oradata \
  -v $(pwd)/init-scripts:/container-entrypoint-initdb.d \
  gvenzl/oracle-free:23-slim
```

Scripts run in alphabetical order — prefix them with `01_`, `02_` etc. to control execution order. Scripts only run on first startup (when the data volume is empty).

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ORACLE_PASSWORD` | Yes | — | Password for SYS, SYSTEM, and PDBADMIN |
| `ORACLE_DATABASE` | No | — | Creates an additional PDB with this name |
| `ORACLE_RANDOM_PASSWORD` | No | — | Set to any value to generate a random password (printed in logs) |
| `APP_USER` | No | — | Creates an application user in FREEPDB1 |
| `APP_USER_PASSWORD` | No | — | Password for `APP_USER` |

Using `APP_USER` and `APP_USER_PASSWORD` is a convenient shortcut for simple setups:

```bash
docker run -d \
  --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1# \
  -e APP_USER=appdev \
  -e APP_USER_PASSWORD=AppPass1# \
  gvenzl/oracle-free:23-slim
```

This automatically creates the `appdev` user in `FREEPDB1` with `DB_DEVELOPER_ROLE` granted.

---

## Connecting Your Application

### Connection string formats

```bash
# SQL*Plus
sqlplus appdev/AppPass1#@localhost:1521/FREEPDB1

# JDBC (Java / Spring Boot)
jdbc:oracle:thin:@localhost:1521/FREEPDB1

# Python (python-oracledb)
oracle+oracledb://appdev:AppPass1#@localhost:1521/?service_name=FREEPDB1

# Node.js (node-oracledb)
"connectString": "localhost:1521/FREEPDB1"

# SQL Developer / DBeaver
Host: localhost  Port: 1521  Service: FREEPDB1
```

### Spring Boot with Docker Compose

Spring Boot 3.1+ has built-in Docker Compose support. Add the dependency and Spring auto-starts the compose stack when the app launches:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-docker-compose</artifactId>
  <scope>runtime</scope>
</dependency>
```

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:oracle:thin:@localhost:1521/FREEPDB1
    username: appdev
    password: AppPass1#
    driver-class-name: oracle.jdbc.OracleDriver
```

### Python (python-oracledb thin mode — no Oracle Client needed)

```python
import oracledb

conn = oracledb.connect(
    user="appdev",
    password="AppPass1#",
    dsn="localhost:1521/FREEPDB1"
)

cursor = conn.cursor()
cursor.execute("SELECT banner FROM v$version")
print(cursor.fetchone())
conn.close()
```

---

## Health Checks and Waiting for Ready

Never connect to Oracle before it signals it is ready. In shell scripts use a loop:

```bash
#!/bin/bash
echo "Waiting for Oracle to be ready..."
until docker exec oracle23ai sqlplus -L system/StrongPass1#@//localhost:1521/FREEPDB1 /dev/null 2>&1 | grep -q "Connected"; do
  echo "  Still starting..."
  sleep 5
done
echo "Oracle is ready."
```

In CI/CD pipelines (GitHub Actions):

```yaml
- name: Start Oracle
  run: |
    docker run -d \
      --name oracle23ai \
      -p 1521:1521 \
      -e ORACLE_PASSWORD=StrongPass1# \
      gvenzl/oracle-free:23-slim-faststart

- name: Wait for Oracle
  run: |
    timeout 120 bash -c 'until docker logs oracle23ai 2>&1 | grep -q "DATABASE IS READY TO USE"; do sleep 3; done'

- name: Run tests
  run: npm test
```

---

## Backup and Restore

### Export with Data Pump

```bash
# Create a directory object inside the container
docker exec oracle23ai sqlplus system/StrongPass1#@//localhost:1521/FREEPDB1 <<EOF
CREATE OR REPLACE DIRECTORY dp_dir AS '/opt/oracle/backup';
GRANT READ, WRITE ON DIRECTORY dp_dir TO appdev;
EXIT;
EOF

# Run expdp
docker exec oracle23ai expdp appdev/AppPass1#@//localhost:1521/FREEPDB1 \
  directory=dp_dir \
  dumpfile=appdev_$(date +%Y%m%d).dmp \
  logfile=appdev_export.log \
  schemas=appdev

# Copy the dump file to your host
docker cp oracle23ai:/opt/oracle/backup/appdev_$(date +%Y%m%d).dmp ./backups/
```

### Import with Data Pump

```bash
# Copy dump file into container
docker cp ./backups/appdev_20250301.dmp oracle23ai:/opt/oracle/backup/

# Run impdp
docker exec oracle23ai impdp appdev/AppPass1#@//localhost:1521/FREEPDB1 \
  directory=dp_dir \
  dumpfile=appdev_20250301.dmp \
  logfile=appdev_import.log \
  schemas=appdev \
  remap_schema=appdev:appdev
```

---

## Upgrading to a New Image Version

```bash
# Pull the new image
docker pull gvenzl/oracle-free:23-slim

# Stop and remove the old container (data volume is preserved)
docker compose down

# Start with the new image — data volume is reattached automatically
docker compose up -d
```

Because your data lives in a named volume, not in the container, upgrades are safe — the new container mounts the same volume and Oracle performs any required upgrades on first startup.

---

## Troubleshooting

### Container exits immediately

```bash
# Check logs for the actual error
docker logs oracle23ai

# Most common causes:
# 1. Not enough memory — increase Docker Desktop RAM to 4 GB minimum
# 2. Port 1521 already in use — check with: netstat -an | grep 1521
# 3. Volume permission issue on Linux — chown -R 54321:54321 /your/data/dir
```

### ORA-12547 on fresh pull

This can happen when upgrading from Oracle 23c Free to 23ai Free if Docker has cached dangling image layers. Fix it by pruning stale images:

```bash
docker system prune -f
docker pull gvenzl/oracle-free:23-slim
```

### Cannot connect — ORA-12541: no listener

```bash
# Check the listener inside the container
docker exec oracle23ai lsnrctl status

# Restart the listener
docker exec oracle23ai lsnrctl stop
docker exec oracle23ai lsnrctl start
```

### Data volume appears empty after restart

You stopped the container with `docker compose down -v` which removes volumes. Use `docker compose down` (without `-v`) to preserve data.

---

## Security Checklist for Team Environments

- Store `ORACLE_PASSWORD` in a `.env` file and add `.env` to `.gitignore` — never commit passwords
- Use Docker secrets for production deployments on Docker Swarm or Kubernetes
- Expose port 1521 only to `127.0.0.1` in shared environments: `-p 127.0.0.1:1521:1521`
- Rotate the SYS/SYSTEM password immediately after first startup in any environment accessible to others
- Use a dedicated application user (`APP_USER`) with minimal privileges — never connect your app as SYSTEM

```bash
# Bind to localhost only — not accessible from other machines on the network
docker run -d \
  --name oracle23ai \
  -p 127.0.0.1:1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1# \
  gvenzl/oracle-free:23-slim
```
