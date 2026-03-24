---
layout: article.njk
title: "Upgrading from Oracle 19c to 23ai"
description: "A practical guide to upgrading Oracle Database 19c to 23ai — covering upgrade paths, AutoUpgrade tool walkthrough, pre-upgrade checks, non-CDB to CDB migration, common blockers, and post-upgrade validation."
date: 2025-01-18
author: Oracle 23ai Help Team
readTime: 18 min
tag: Migration
category: install
difficulty: intermediate
order: 2
templateEngineOverride: md
permalink: /install/upgrading-19c-to-23ai/index.html
tags:
  - install
  - migration
---

## Before You Start: What Makes This Upgrade Different

Upgrading to Oracle 23ai is not just a routine version bump. Two things make it different from previous Oracle upgrades:

**1. Direct upgrade is only supported from 19c and 21c.**
Oracle Database 23ai only allows direct upgrades from versions Oracle Database 19c and 21c. Users with older versions need to perform at least one extra upgrade first. If you are on 12c or 18c, you must upgrade to 19c first before proceeding to 23ai.

**2. Non-CDB architecture is gone.**
Oracle Database 23ai no longer supports the classic non-CDB architecture, requiring adoption of the CDB/PDB model introduced in 12.2. If your 19c database is a non-CDB, converting it to a PDB is a required step in the upgrade process.

---

## Upgrade Paths at a Glance

| Source | Target | Path |
|--------|--------|------|
| Oracle 19c CDB/PDB | Oracle 23ai | Direct — AutoUpgrade recommended |
| Oracle 19c non-CDB | Oracle 23ai | Convert to PDB first, then upgrade |
| Oracle 21c | Oracle 23ai | Direct — AutoUpgrade recommended |
| Oracle 18c or earlier | Oracle 23ai | Upgrade to 19c first, then to 23ai |
| OCI Autonomous DB 19c | OCI Autonomous DB 23ai | Console clone-and-upgrade (few clicks) |

---

## Pre-Upgrade Checklist

Work through this checklist before touching the database. Skipping steps here is where most upgrade problems originate.

### 1. Run the Pre-Upgrade Information Tool

Oracle provides `preupgrade.jar` — download the latest version from My Oracle Support (Doc ID 884522.1) or directly from oracle.com. Always use the latest version even if one is already present in your Oracle Home.

```bash
java -jar preupgrade.jar FILE TEXT DIR /tmp/preupgrade_output
cat /tmp/preupgrade_output/preupgrade.log
cat /tmp/preupgrade_output/postupgrade_fixups.sql
```

Fix every `ERROR` and `WARNING` in `preupgrade.log` before proceeding.

### 2. Check the COMPATIBLE parameter

```sql
SELECT name, value FROM v$parameter WHERE name = 'compatible';
```

Leave `COMPATIBLE` at `19.0.0` after upgrading — only raise it after your applications are validated on 23ai. Raising it is irreversible.

### 3. Verify sufficient disk space

A 23ai Oracle Home requires approximately 10 GB. Plan for at least 20 GB of free disk space beyond your current data files.

### 4. Enable archivelog mode

```sql
SELECT log_mode FROM v$database;

SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;
```

### 5. Create a Guaranteed Restore Point

```sql
CREATE RESTORE POINT before_23ai_upgrade GUARANTEE FLASHBACK DATABASE;

SELECT name, scn, guarantee_flashback_database
FROM v$restore_point;
```

### 6. Back up the database

```bash
rman target /

RMAN> BACKUP DATABASE PLUS ARCHIVELOG;
```

---

## The AutoUpgrade Tool

AutoUpgrade is Oracle's recommended approach for all on-premises upgrades from 19c to 23ai. Always download the latest version from oracle.com/autoupgrade.

### Create the configuration file

```properties
global.autoupg_log_dir=/u01/autoupgrade/logs

upg1.source_home=/u01/app/oracle/product/19.0.0/dbhome_1
upg1.target_home=/u01/app/oracle/product/23.0.0/dbhome_1
upg1.sid=PROD19C
upg1.start_time=NOW
upg1.upgrade_node=localhost
```

### Run in three stages

```bash
# Stage 1 — analyze only, no changes
java -jar autoupgrade.jar -config upgrade.cfg -mode analyze

# Stage 2 — apply automated fixes
java -jar autoupgrade.jar -config upgrade.cfg -mode fixups

# Stage 3 — perform the upgrade
java -jar autoupgrade.jar -config upgrade.cfg -mode deploy
```

Monitor progress:

```bash
java -jar autoupgrade.jar -config upgrade.cfg -console

upg> lsj           # List jobs
upg> status -job 1  # Job status
upg> logs -job 1    # Tail logs
```

---

## Non-CDB to PDB Migration

If your 19c source is a non-CDB, add these lines to your AutoUpgrade config:

```properties
upg1.target_cdb=CDB23AI
upg1.target_pdb_name.PROD19C=PROD_PDB
```

AutoUpgrade handles the conversion automatically.

---

## Post-Upgrade Validation

```bash
# Run post-upgrade fixups
sqlplus / as sysdba
SQL> @/tmp/preupgrade_output/postupgrade_fixups.sql

# Recompile invalid objects
SQL> @$ORACLE_HOME/rdbms/admin/utlrp.sql
SQL> SELECT COUNT(*) FROM dba_invalid_objects;
```

```sql
-- Confirm version and PDB status
SELECT banner FROM v$version;
SELECT name, open_mode FROM v$pdbs;
```

---

## Common Blockers and Fixes

| Problem | Fix |
|---------|-----|
| Timezone version mismatch | Run `utltz_upg_check.sql` then `utltz_upg_apply.sql` from the 23ai home |
| Deprecated parameters | Remove `utl_file_dir`, `_allow_resetlogs_corruption` from SPFILE |
| Invalid objects post-upgrade | Run `utlrp.sql` to recompile |
| Non-CDB users missing | Check `dba_users` inside the PDB after migration |

---

## Rollback Plan

**Option A — Flashback to Restore Point (fastest)**

```sql
STARTUP MOUNT;
FLASHBACK DATABASE TO RESTORE POINT before_23ai_upgrade;
ALTER DATABASE OPEN RESETLOGS;
```

**Option B — RMAN restore**

```bash
rman target /
RMAN> RESTORE DATABASE;
RMAN> RECOVER DATABASE;
RMAN> ALTER DATABASE OPEN RESETLOGS;
```

---

## First Features to Enable After Upgrade

| Feature | How to enable |
|---------|--------------|
| Schema Privileges | `GRANT SELECT ANY TABLE ON SCHEMA hr TO app_user` |
| Vector Search | `CREATE TABLE t (v VECTOR(1536))` |
| JSON Duality Views | `CREATE JSON RELATIONAL DUALITY VIEW ...` |
| SQL Firewall | `EXEC DBMS_SQL_FIREWALL.ENABLE` |

Raise COMPATIBLE to 23.0.0 only after everything is stable:

```sql
ALTER SYSTEM SET COMPATIBLE = '23.0.0' SCOPE = SPFILE;
SHUTDOWN IMMEDIATE;
STARTUP;
```
