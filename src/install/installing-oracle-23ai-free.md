---
layout: article.njk
title: "Installing Oracle Database 23ai Free"
description: "Complete installation guide for Oracle Database 23ai Free on Oracle Linux, Windows, and Docker. Includes system requirements, step-by-step instructions, post-install configuration, and troubleshooting tips."
date: 2025-03-20
author: Oracle 23ai Help Team
readTime: 20 min
tag: Getting Started
category: install
difficulty: beginner
order: 1
tags:
  - install
related:
  - vector-search
  - common-ora-errors
---

## Overview

Oracle Database 23ai Free is a full-featured edition of Oracle Database 23ai with limits of 2 CPU threads, 2 GB RAM, and 12 GB user data. All 23ai features — including VECTOR, AI Functions, and JSON Relational Duality — are available within the free edition. No license is required.

| Resource | Limit |
|----------|-------|
| CPU threads | 2 |
| RAM | 2 GB |
| User data | 12 GB |
| License | Free (no cost) |

Choose your platform below and follow the steps in order.

---

## Linux (Oracle Linux / RHEL)

### System Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Oracle Linux 8 or 9 (x86_64) |
| RAM | 1 GB minimum, 2 GB recommended |
| Disk | 10 GB minimum free space |
| CPU | x86_64 (64-bit) |

> Oracle Linux 10 is not yet officially supported for Oracle Database 23ai Free. Use Oracle Linux 8 or 9 for the most stable experience.

### Step 1 — Update the system

Start with a fully updated system before installing any Oracle packages.

```bash
sudo dnf update -y
sudo reboot
```

### Step 2 — Install the pre-install package

The Oracle pre-install meta-package automatically configures kernel parameters, system limits, and creates the `oracle` OS user. It is the recommended way to prepare your system.

```bash
sudo dnf install -y oracle-database-preinstall-23ai
```

### Step 3 — Download the RPM

```bash
cd /tmp
wget https://download.oracle.com/otn-pub/otn_software/db-free/oracle-database-free-23ai-1.0-1.el9.x86_64.rpm

# Verify the download (~1.2 GB)
ls -lh oracle-database-free-23ai-*.rpm
```

> If the direct download fails, visit **oracle.com/database/free/get-started** and download the RPM manually after accepting the license agreement.

### Step 4 — Install the RPM

```bash
sudo dnf localinstall -y oracle-database-free-23ai-*.rpm
```

The installer creates the following directories:

| Path | Purpose |
|------|---------|
| `/opt/oracle/product/23ai/dbhomeFree` | Oracle software (ORACLE_HOME) |
| `/opt/oracle/oradata/FREE` | Database data files |
| `/opt/oracle/diag/rdbms/free/FREE/trace/` | Alert log and trace files |

### Step 5 — Configure the database

Run the configuration script to create the `FREE` container database and `FREEPDB1` pluggable database.

```bash
sudo /etc/init.d/oracle-free-23ai configure
```

> **Important:** Save the passwords displayed during configuration. The script generates the initial SYS, SYSTEM, and PDBADMIN passwords — change them immediately after installation.

### Step 6 — Set up environment variables

```bash
sudo su - oracle
cat > ~/.bash_profile << 'EOF'
export ORACLE_BASE=/opt/oracle
export ORACLE_HOME=/opt/oracle/product/23ai/dbhomeFree
export ORACLE_SID=FREE
export PATH=$ORACLE_HOME/bin:$PATH
export LD_LIBRARY_PATH=$ORACLE_HOME/lib:/lib:/usr/lib
export CLASSPATH=$ORACLE_HOME/jlib:$ORACLE_HOME/rdbms/jlib
EOF
source ~/.bash_profile
```

### Step 7 — Enable auto-start

```bash
sudo systemctl enable oracle-free-23ai
sudo systemctl start oracle-free-23ai
```

### Step 8 — Verify the installation

```bash
# Check service status
sudo systemctl status oracle-free-23ai

# Connect as SYSDBA
sudo su - oracle
sqlplus / as sysdba
```

```sql
SELECT banner FROM v$version;
SHOW PDBS;
EXIT;
```

You should see `FREEPDB1` listed with `READ WRITE` status.

### Step 9 — Change passwords and create a developer user

```sql
-- Change default passwords immediately
ALTER USER SYS IDENTIFIED BY YourNewSysPassword;
ALTER USER SYSTEM IDENTIFIED BY YourNewSystemPassword;

-- Switch to FREEPDB1 and change PDBADMIN
ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER USER PDBADMIN IDENTIFIED BY YourNewPdbAdminPassword;

-- Create a dedicated developer user
CREATE USER appdev IDENTIFIED BY YourAppPassword;
GRANT DB_DEVELOPER_ROLE, UNLIMITED TABLESPACE TO appdev;

-- Test the connection from your terminal:
-- sqlplus appdev/YourAppPassword@localhost:1521/FREEPDB1
```

### Linux Quick Reference

| Action | Command |
|--------|---------|
| Start database | `sudo systemctl start oracle-free-23ai` |
| Stop database | `sudo systemctl stop oracle-free-23ai` |
| Check status | `sudo systemctl status oracle-free-23ai` |
| View alert log | `tail -f $ORACLE_BASE/diag/rdbms/free/FREE/trace/alert_FREE.log` |
| Listener status | `lsnrctl status` |
| Connect to PDB | `sqlplus appdev/pw@localhost:1521/FREEPDB1` |

---

## Windows

### System Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Windows Server 2019 or 2022 (64-bit) |
| RAM | 8 GB minimum recommended |
| Disk | 50 GB free space recommended |
| CPU | Intel or AMD x86-64 |
| Runtime | .NET Framework 4.8 |

> Windows Home Edition is not supported. Use Windows Server or Windows 10/11 Pro (64-bit).

### Step 1 — Prepare the environment

Complete this pre-flight checklist before running the installer:

- Run as a Windows account with **Administrator privileges**
- Disable UAC: Control Panel → User Accounts → Change UAC Settings → set to **Never Notify**
- Allow TCP port **1521** through Windows Firewall
- Install **.NET Framework 4.8** if not already present
- Apply all latest **Windows Updates**
- Ensure `ORACLE_HOME` and `TNS_ADMIN` environment variables are **not** already set from a previous Oracle installation

### Step 2 — Download Oracle Database 23ai Free

Go to **oracle.com/database/technologies/oracle-database-software-downloads.html** and download **Oracle Database 23ai Free for Windows (64-bit)**. Extract the `.zip` file to a local folder such as `C:\Oracle23ai`.

> Ensure the installation directory cannot be modified by the **Authenticated Users** group — this is a security requirement from Oracle.

### Step 3 — Run the Oracle Universal Installer

Open a Command Prompt **as Administrator**, navigate to the extracted folder, and run `setup.exe`. Follow the InstallShield wizard:

1. In the **Welcome** window click **Next**
2. Accept the license agreement and click **Next**
3. The installer runs a prerequisite check — resolve any failures before continuing
4. In **Oracle Database Information**, set a password for SYS, SYSTEM, and PDBADMIN — must contain uppercase, lowercase, a digit, and a special character
5. Review the **Summary** and click **Install**
6. When complete, the **Oracle Database Installed Successfully** window appears

The installer creates files at these default locations:

| Path | Purpose |
|------|---------|
| `C:\app\<user>\product\23ai\dbhomeFree` | Oracle Home |
| `C:\app\<user>\oradata\FREE` | Database data files |
| `C:\app\<user>\diag\rdbms\free\free\trace\` | Alert log |

### Step 4 — Configure the listener and verify

Open a Command Prompt as Administrator:

```cmd
REM Check listener status
lsnrctl status

REM Start listener if not running
lsnrctl start

REM Connect and verify
sqlplus / as sysdba
```

```sql
-- Open all pluggable databases
ALTER PLUGGABLE DATABASE ALL OPEN;
ALTER PLUGGABLE DATABASE ALL SAVE STATE;

-- Confirm version
SELECT * FROM v$version;
EXIT;
```

### Step 5 — Enable automatic startup

Open `services.msc` and set both Oracle services to **Automatic** startup type:

| Service | Startup Type |
|---------|-------------|
| `OracleServiceFREE` | Automatic |
| `OracleOraDB23HomeTNSListener` | Automatic |

### Step 6 — Create a developer user

```sql
sqlplus / as sysdba

-- Switch to FREEPDB1
ALTER SESSION SET CONTAINER = FREEPDB1;

-- Create developer user
CREATE USER appdev IDENTIFIED BY YourAppPassword;
GRANT DB_DEVELOPER_ROLE, UNLIMITED TABLESPACE TO appdev;
EXIT;
```

### Step 7 — Connect with SQL Developer

Download Oracle SQL Developer from **oracle.com/sqldeveloper** and create a new connection:

| Setting | Value |
|---------|-------|
| Hostname | `localhost` |
| Port | `1521` |
| Service Name | `FREEPDB1` |
| Username | `appdev` (or SYSTEM) |
| Password | Password set during install |

---

## Docker / Podman

Docker is the fastest way to get Oracle 23ai running on any platform — including macOS Apple Silicon and Windows.

### System Requirements

| Component | Requirement |
|-----------|-------------|
| Engine | Docker 20+ or Podman 4+ |
| Architecture | x86_64 or ARM (aarch64) |
| RAM | 2 GB allocated to container minimum |
| Startup time | Under 2 minutes |

### Step 1 — Pull and run the slim image

```bash
docker run -d \
  --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1 \
  gvenzl/oracle-free:23-slim

# Monitor startup — wait for "DATABASE IS READY TO USE!"
docker logs -f oracle23ai
```

> When you see **"DATABASE IS READY TO USE!"** in the logs, the database is fully started and accepting connections on port 1521.

### Step 2 — Run with persistent storage (recommended)

By default the container is ephemeral — all data is lost when it stops. Mount a named volume to persist data between restarts.

```bash
# Create a named volume
docker volume create oracle-data

# Run with persistence
docker run -d \
  --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1 \
  -v oracle-data:/opt/oracle/oradata \
  gvenzl/oracle-free:23-slim
```

### Step 3 — Podman on Apple Silicon / ARM

```bash
podman run --rm --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=StrongPass1 \
  gvenzl/oracle-free:23-slim
```

### Step 4 — Connect and create a developer user

```bash
# Connect to SQL*Plus inside the container
docker exec -it oracle23ai sqlplus / as sysdba
```

```sql
-- Switch to FREEPDB1
ALTER SESSION SET CONTAINER = FREEPDB1;

-- Create a developer user
GRANT DB_DEVELOPER_ROLE, UNLIMITED TABLESPACE
  TO developer IDENTIFIED BY "free";

-- Connect from outside the container:
-- sqlplus developer/free@localhost:1521/FREEPDB1
```

### Image Variants

| Image | Best for |
|-------|---------|
| `gvenzl/oracle-free:23-slim` | Development — smallest, fastest pull |
| `gvenzl/oracle-free:23` | Standard tools included |
| `gvenzl/oracle-free:23-full` | All Oracle components |
| `gvenzl/oracle-free:23-slim-faststart` | Starts in seconds, pre-built DB |

### Docker Quick Reference

| Action | Command |
|--------|---------|
| Start container | `docker start oracle23ai` |
| Stop container | `docker stop oracle23ai` |
| View logs | `docker logs -f oracle23ai` |
| Connect SQL*Plus | `docker exec -it oracle23ai sqlplus / as sysdba` |
| Remove container | `docker rm -f oracle23ai` |
| List volumes | `docker volume ls` |

---

## Troubleshooting

### Database won't start (Linux)

Check the alert log for errors:

```bash
sudo su - oracle
tail -100 $ORACLE_BASE/diag/rdbms/free/FREE/trace/alert_FREE.log
```

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| ORA-00845 | Not enough RAM | Free up memory or increase swap |
| ORA-27102 | Out of memory | Reduce `sga_target` in `init.ora` |
| Port 1521 in use | Port conflict | Run `ss -tlnp \| grep 1521` to find it |
| Permission error | Wrong ownership | `chown -R oracle:oinstall /opt/oracle` |

### Cannot connect to database

```sql
-- Check instance status
SELECT status FROM v$instance;

-- Check PDB status
SHOW PDBS;

-- Open PDB if closed
ALTER PLUGGABLE DATABASE FREEPDB1 OPEN;
```

### Docker container exits immediately

```bash
# Check what went wrong
docker logs oracle23ai

# Most common fix: not enough memory allocated to Docker
# Docker Desktop → Settings → Resources → increase RAM to at least 4 GB
```

### ORA-01017: invalid username/password

Make sure you are connecting to the PDB, not the CDB root:

```bash
# Wrong — connects to CDB root
sqlplus system/password@localhost:1521/FREE

# Correct — connects to the PDB
sqlplus system/password@localhost:1521/FREEPDB1
```
