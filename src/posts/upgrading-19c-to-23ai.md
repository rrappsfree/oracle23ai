---
layout: post.njk
title: "Upgrading from Oracle 19c to 23ai: Lessons Learned"
description: "A practical guide to upgrading Oracle Database 19c to 23ai — covering upgrade paths, AutoUpgrade tool walkthrough, pre-upgrade checks, non-CDB to CDB migration, common blockers, and post-upgrade validation."
date: 2025-01-18
author: Oracle 23ai Help Team
readTime: 18 min
tag: Migration
category: blog
templateEngineOverride: md
tags:
  - posts
  - migration
  - upgrade
  - install
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
# Run preupgrade.jar against your 19c database
java -jar preupgrade.jar FILE TEXT DIR /tmp/preupgrade_output

# Review the output
cat /tmp/preupgrade_output/preupgrade.log
cat /tmp/preupgrade_output/postupgrade_fixups.sql
```

The tool generates three files:

| File | Purpose |
|------|---------|
| `preupgrade.log` | Issues that must be fixed before upgrade |
| `preupgrade_fixups.sql` | Run this against 19c BEFORE upgrading |
| `postupgrade_fixups.sql` | Run this against 23ai AFTER upgrading |

Fix every `ERROR` and `WARNING` in `preupgrade.log` before proceeding. Common items include invalid objects, timezone version mismatches, and deprecated parameters.

### 2. Check the COMPATIBLE parameter

```sql
-- Check current COMPATIBLE setting
SELECT name, value FROM v$parameter WHERE name = 'compatible';
```

After upgrading to 23ai, Oracle recommends leaving `COMPATIBLE` at `19.0.0` initially and only raising it after your applications have been validated on 23ai. Raising `COMPATIBLE` is irreversible — you cannot downgrade once it is changed.

### 3. Verify sufficient disk space

```sql
-- Check datafile sizes
SELECT ROUND(SUM(bytes)/1024/1024/1024, 2) AS total_gb
FROM dba_data_files;

-- Check free space in tablespaces
SELECT tablespace_name,
       ROUND(bytes/1024/1024, 0) AS free_mb
FROM dba_free_space
ORDER BY free_mb;
```

A 23ai Oracle Home requires approximately 10 GB. Add buffer for the upgrade process itself — plan for at least 20 GB of free disk space beyond your current data files.

### 4. Enable archivelog mode

```sql
-- Check if archivelog is enabled
SELECT log_mode FROM v$database;

-- Enable if not already on (requires brief downtime)
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;
```

### 5. Create a Guaranteed Restore Point

```sql
-- Create a restore point BEFORE the upgrade starts
CREATE RESTORE POINT before_23ai_upgrade GUARANTEE FLASHBACK DATABASE;

-- Verify it was created
SELECT name, scn, guarantee_flashback_database
FROM v$restore_point;
```

If the upgrade fails or causes unexpected issues, you can flashback the entire database to this point instantly.

### 6. Back up the database

Take a full RMAN backup immediately before starting the upgrade:

```bash
rman target /

RMAN> BACKUP DATABASE PLUS ARCHIVELOG;
RMAN> LIST BACKUP SUMMARY;
```

---

## The AutoUpgrade Tool

AutoUpgrade offers enhanced diagnosability, improved logging, the option to continue after resolving errors, capability to restore from a failed attempt, support for converting a non-CDB to a PDB, and the ability to schedule the migration process. It is Oracle's recommended approach for all on-premises upgrades from 19c to 23ai.

### Download AutoUpgrade

Always download the latest version — the copy bundled with your Oracle Home may be outdated:

```bash
# Download from oracle.com/autoupgrade (no MOS login required)
wget https://download.oracle.com/otn_software/db/autoupgrade/autoupgrade_latest.jar

# Or copy from the 23ai Oracle Home if already installed
cp $ORACLE_HOME_23AI/rdbms/admin/autoupgrade.jar /tmp/
```

### Create the AutoUpgrade Configuration File

Create `upgrade.cfg` in a working directory:

```properties
# Global settings
global.autoupg_log_dir=/u01/autoupgrade/logs

# Database 1 — upgrade a CDB from 19c to 23ai
upg1.source_home=/u01/app/oracle/product/19.0.0/dbhome_1
upg1.target_home=/u01/app/oracle/product/23.0.0/dbhome_1
upg1.sid=PROD19C
upg1.start_time=NOW
upg1.upgrade_node=localhost
```

For a non-CDB being converted to a PDB, add target CDB details:

```properties
upg1.source_home=/u01/app/oracle/product/19.0.0/dbhome_1
upg1.target_home=/u01/app/oracle/product/23.0.0/dbhome_1
upg1.sid=PROD19C
upg1.target_cdb=CDB23AI
upg1.target_pdb_name.PROD19C=PROD_PDB
```

### Run AutoUpgrade in Analyze Mode First

```bash
# Analyze mode — read-only, no changes made
java -jar autoupgrade.jar -config upgrade.cfg -mode analyze

# Review the analysis report
cat /u01/autoupgrade/logs/cfgtoollogs/upgrade/auto/PROD19C/*/autoupgrade_*.log
```

Analyze mode runs all pre-checks and generates a report without touching the database. Fix any issues it reports before moving to the next mode.

### Run AutoUpgrade in Fixups Mode

```bash
# Fixups mode — applies automated fixes to prepare for upgrade
java -jar autoupgrade.jar -config upgrade.cfg -mode fixups
```

### Run AutoUpgrade in Deploy Mode (the actual upgrade)

```bash
# Deploy mode — performs the full upgrade
java -jar autoupgrade.jar -config upgrade.cfg -mode deploy
```

Monitor progress in real time using the AutoUpgrade console:

```bash
# Attach to a running AutoUpgrade job
java -jar autoupgrade.jar -config upgrade.cfg -mode deploy &

# In another terminal
java -jar autoupgrade.jar -config upgrade.cfg -console

# Useful console commands
upg> lsj          # List all jobs
upg> status -job 1 # Detailed status for job 1
upg> logs -job 1   # Tail the log for job 1
```

---

## Non-CDB to PDB Migration

If your 19c source is a non-CDB, you must convert it before or during the upgrade. AutoUpgrade handles this automatically when you specify `target_cdb` and `target_pdb_name` in the config file.

To do it manually:

```bash
# Step 1 — generate the PDB manifest from the non-CDB
sqlplus / as sysdba

SQL> EXEC DBMS_PDB.DESCRIBE(pdb_descr_file => '/tmp/19c_manifest.xml');
SQL> EXIT;

# Step 2 — on the 23ai CDB, plug in the manifest
sqlplus / as sysdba

SQL> CREATE PLUGGABLE DATABASE prod_pdb
  2  USING '/tmp/19c_manifest.xml'
  3  COPY
  4  FILE_NAME_CONVERT = ('/u01/oradata/PROD19C/', '/u01/oradata/PROD_PDB/');

SQL> ALTER PLUGGABLE DATABASE prod_pdb OPEN UPGRADE;

# Step 3 — run datapatch and upgrade scripts
SQL> EXIT;

cd $ORACLE_HOME_23AI
./perl/bin/perl rdbms/admin/catctl.pl -c 'PROD_PDB' rdbms/admin/catupgrd.sql

# Step 4 — run post-upgrade fixups
SQL> ALTER SESSION SET CONTAINER = PROD_PDB;
SQL> @/tmp/preupgrade_output/postupgrade_fixups.sql
```

---

## Post-Upgrade Validation

After the upgrade completes, validate thoroughly before pointing applications at the new database.

### 1. Run post-upgrade fixups

```bash
sqlplus / as sysdba

SQL> @/tmp/preupgrade_output/postupgrade_fixups.sql
SQL> EXIT;
```

### 2. Recompile invalid objects

```bash
cd $ORACLE_HOME_23AI/rdbms/admin
sqlplus / as sysdba

SQL> @utlrp.sql
SQL> SELECT COUNT(*) FROM dba_invalid_objects;
-- Should return 0 or a very small number of pre-existing invalids
```

### 3. Check the database version and PDB status

```sql
SELECT banner FROM v$version;
SHOW PDBS;

-- All PDBs should show READ WRITE
SELECT name, open_mode FROM v$pdbs;
```

### 4. Run SQL Performance Analyzer (recommended)

Capture a SQL Tuning Set from your 19c production workload before the upgrade and replay it on 23ai to catch any SQL regressions:

```sql
-- On 19c before upgrade: capture workload into a SQL Tuning Set
BEGIN
  DBMS_SQLTUNE.CREATE_SQLSET(sqlset_name => 'pre_upgrade_sts');
END;
/

DECLARE
  cur DBMS_SQLTUNE.SQLSET_CURSOR;
BEGIN
  OPEN cur FOR
    SELECT VALUE(p) FROM TABLE(
      DBMS_SQLTUNE.SELECT_CURSOR_CACHE(
        basic_filter => 'elapsed_time > 1000000',
        attribute_list => 'ALL')) p;
  DBMS_SQLTUNE.LOAD_SQLSET(
    sqlset_name => 'pre_upgrade_sts',
    populate_cursor => cur);
END;
/
```

After upgrade, run SPA to compare execution plans:

```sql
-- Create an SPA task on 23ai
DECLARE
  task_name VARCHAR2(30);
BEGIN
  task_name := DBMS_SQLPA.CREATE_ANALYSIS_TASK(
    sqlset_name => 'pre_upgrade_sts',
    task_name   => 'upgrade_spa_task');
END;
/

-- Execute the before/after comparison
BEGIN
  DBMS_SQLPA.EXECUTE_ANALYSIS_TASK(
    task_name => 'upgrade_spa_task',
    execution_type => 'COMPARE PERFORMANCE');
END;
/
```

### 5. Verify application connectivity

```sql
-- Check all application service accounts can connect
-- Connect from the application tier, not just from the DB server

-- Verify listener is serving the new database
lsnrctl status

-- Confirm tnsnames.ora or JDBC connection strings point to 23ai
```

---

## Common Blockers and Fixes

### ORA-00600 during upgrade

Usually caused by corrupted dictionary objects. Run the pre-upgrade tool again on a restored copy of the database to identify the specific object. Most can be resolved by dropping and recreating the affected component before re-running the upgrade.

### Timezone version mismatch

```sql
-- Check current timezone version
SELECT version FROM v$timezone_file;

-- Update to the latest timezone file before upgrading
-- Run from the 23ai Oracle Home
cd $ORACLE_HOME_23AI
./perl/bin/perl rdbms/admin/utltz_upg_check.sql
./perl/bin/perl rdbms/admin/utltz_upg_apply.sql
```

### Deprecated initialization parameters

AutoUpgrade and `preupgrade.jar` both flag deprecated parameters. Common ones removed in 23ai:

| Deprecated parameter | Replacement |
|---------------------|-------------|
| `utl_file_dir` | Oracle Directory objects |
| `_allow_resetlogs_corruption` | Remove — not supported |
| `parallel_server` | `cluster_database` |

Remove or replace these from your `init.ora` or SPFILE before upgrading.

### Application users missing after non-CDB to PDB migration

Local users in the non-CDB become local users in the PDB. Common users (prefixed with `C##`) are CDB-wide. Check that all application users exist in the PDB after migration:

```sql
ALTER SESSION SET CONTAINER = PROD_PDB;
SELECT username, account_status FROM dba_users ORDER BY username;
```

---

## Lessons Learned from Real Upgrades

The biggest hurdle in Oracle 19c to 23ai migrations is often not technical. Check that 23ai is available in your region. If upgrading into an existing compartment, ensure you have enough IP addresses. Licensing is carried into the clone — verify this is correct. Remember to consider your requirements around Disaster Recovery as this is not enabled by default.

A few more hard-won lessons from the field:

**Leave COMPATIBLE at 19.0.0 for 90 days.** The COMPATIBLE parameter of the database remains at 19.0.0 after upgrade and you can modify this some time later after things have stabilized. Raising it unlocks 23ai-specific features but makes rollback impossible.

**Always test with a clone first.** Before submitting an in-place upgrade on critical production databases, test your applications with a 23ai clone or refreshable clone of your source database. Many surprises only appear when running your actual application workload.

**Old Oracle Home cleanup.** Oracle recommends removing the old Database Home after a successful upgrade. Ensure the `.bashrc` file in the oracle user's home directory has been updated to point to the 23ai Database Home.

**Client compatibility.** Oracle Doc ID 207303.1 confirms 23ai clients are compatible with 21c and 19c servers, but not earlier versions like 18c or 12c. If you have thin JDBC clients connecting to the database, ensure they are on a supported version before upgrading.

---

## Rollback Plan

If something goes wrong after the upgrade completes, you have two rollback options:

**Option A — Flashback to Restore Point (fastest, within 24–48 hours)**

```sql
-- Connect as SYSDBA and flashback
STARTUP MOUNT;
FLASHBACK DATABASE TO RESTORE POINT before_23ai_upgrade;
ALTER DATABASE OPEN RESETLOGS;
```

This only works while the guaranteed restore point is intact. Drop it only after you are satisfied the upgrade was successful.

**Option B — Restore from RMAN backup**

If the restore point has been dropped or too much time has passed:

```bash
rman target /

RMAN> SHUTDOWN IMMEDIATE;
RMAN> STARTUP MOUNT;
RMAN> RESTORE DATABASE;
RMAN> RECOVER DATABASE;
RMAN> ALTER DATABASE OPEN RESETLOGS;
```

---

## Post-Upgrade: First 23ai Features to Enable

Once your upgrade is validated and stable, these are the highest-value 23ai features to turn on first:

| Feature | How to enable |
|---------|--------------|
| Schema Privileges | `GRANT SELECT ANY TABLE ON SCHEMA hr TO app_user` |
| Vector Search | `CREATE TABLE t (v VECTOR(1536))` — works immediately |
| JSON Duality Views | `CREATE JSON RELATIONAL DUALITY VIEW ...` |
| SQL Firewall | `EXEC DBMS_SQL_FIREWALL.ENABLE` |
| SQL Analysis Report | `EXEC DBMS_SQLDIAG.DUMP_TRACE` |

Raise `COMPATIBLE` to `23.0.0` only after all of the above are working in production and your rollback window has closed:

```sql
ALTER SYSTEM SET COMPATIBLE = '23.0.0' SCOPE = SPFILE;
SHUTDOWN IMMEDIATE;
STARTUP;
```
