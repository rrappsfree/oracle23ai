---
layout: post.njk
title: "Oracle 23ai Unified Auditing: A Complete Guide"
description: "A comprehensive guide to Oracle Database 23ai Unified Auditing — covering architecture, mandatory audits, predefined policies, conditional auditing, column-level auditing, PII protection, audit trail management, compliance frameworks, and migration from traditional auditing."
date: 2025-03-25
author: Oracle 23ai Help Team
readTime: 18 min
tag: Security
category: blog
templateEngineOverride: md
tags:
  - posts
  - security
  - auditing
  - compliance
---

## What Is Unified Auditing?

Oracle Database provides the industry's most comprehensive auditing capability with Unified Auditing — a single framework for capturing the most accurate record of any database activity. Introduced in Oracle Database 12c and significantly enhanced in 23ai, it consolidates all audit records into one central repository called the Unified Audit Trail.

In older Oracle versions, audit records were scattered across multiple tables, operating system files, and XML files — making analysis complex and management painful. Unified Auditing eliminates that complexity by providing a single place for all audit data, regardless of the source.

### Key Benefits

| Benefit | Detail |
|---------|--------|
| Single audit trail | All audit records in one place — `UNIFIED_AUDIT_TRAIL` |
| Tamper-resistant | Stored in `AUDSYS` schema — no one can log in to it directly |
| Lower overhead | Optimized for large audit trails with minimal performance impact |
| Policy-based | Named policies created once, applied to multiple users and roles |
| Compliance-ready | Built-in support for GDPR, HIPAA, SOX, PCI-DSS, and STIG |
| PDB autonomy | Fully independent audit policies at the PDB level |

### What Is New in Oracle 23ai

Oracle 23ai introduces several significant enhancements over previous versions:

- **Column-level auditing** — audit access to specific columns in tables and views, not just the whole table
- **Conditional auditing with configurable conditions** — create precise, context-aware policies that reduce noise
- **Application context capture** — extend the audit trail to include custom application attributes
- **Native JSON indexing** — faster searches on large audit trails
- **AI-powered anomaly detection** — analyze audit data to spot suspicious patterns
- **Simplified policy management** — create, enable, or disable audit policies with a single command

---

## Traditional Auditing Is Gone in 23ai

Traditional auditing is no longer supported in Oracle Database 23ai. If you create a new Oracle Database 23ai, the traditional audit does not exist.

If you upgrade a database that has traditional audit settings, the upgraded database will continue to apply those audit settings and capture them in the older-version audit trail until you disable those audit settings with a NOAUDIT command. You will not be able to create new traditional audit settings or modify the existing ones.

Oracle recommends that you plan your transition to Unified Auditing before you plan an upgrade to Database 23ai.

### Migration Path from Traditional Auditing

```sql
-- Step 1: Define equivalent Unified Audit policies
-- for any custom traditional audit settings

-- Step 2: Disable all traditional audit settings
NOAUDIT ALL;
NOAUDIT ALL PRIVILEGES;
NOAUDIT ALL ON hr.employees;

-- Step 3: Update initialization parameters
ALTER SYSTEM SET AUDIT_TRAIL = NONE SCOPE = SPFILE;
ALTER SYSTEM SET AUDIT_SYS_OPERATIONS = FALSE SCOPE = SPFILE;

-- Step 4: Restart the database
SHUTDOWN IMMEDIATE;
STARTUP;

-- Step 5: Verify traditional auditing is off
SELECT value FROM v$parameter WHERE name = 'audit_trail';
-- Should return NONE
```

---

## Architecture: The Unified Audit Trail

All audit records flow into a single view regardless of their source — SQL statements, privileges, objects, fine-grained audit policies, Oracle Database Vault, Label Security, Data Pump, SQL*Loader, and RMAN.

```sql
-- The single entry point for all audit data
SELECT * FROM UNIFIED_AUDIT_TRAIL;

-- Key columns in UNIFIED_AUDIT_TRAIL
SELECT
  event_timestamp,        -- When the event occurred
  dbusername,             -- Database user
  os_username,            -- OS user
  userhost,               -- Client host
  client_program_name,    -- Application name
  action_name,            -- What was done (SELECT, INSERT etc)
  object_schema,          -- Schema of the object
  object_name,            -- Object name
  sql_text,               -- The actual SQL statement
  unified_audit_policies, -- Which policy triggered this record
  return_code,            -- 0 = success, ORA error = failure
  authentication_type,    -- How the user authenticated
  dbid                    -- Database identifier
FROM UNIFIED_AUDIT_TRAIL
ORDER BY event_timestamp DESC;
```

### Audit Trail Storage

The unified audit trail is stored in the AUDSYS schema, and no one is allowed to log in to that schema in the database. This tamper-resistant design ensures that even a compromised DBA account cannot alter or delete audit records.

---

## Three Pillars of Effective Audit Policy Design

Create effective audit policies that are selective and targeted to your needs by focusing audit configuration on three factors: privileged user activity, security-relevant events, and sensitive data access.

### Pillar 1 — Privileged User Activity

Top-level statements by administrative users, such as SYSDBA and SYSKM, are mandatorily audited when the database is in the closed or mount state. To audit the administrative user activity once the database is open, set up the following audits: Monitor all user-initiated activities of privileged administrators, including SYS. Monitor direct access to the database. Monitor all user-initiated activities of individual high-risk database accounts that have broad system access or access to sensitive data.

```sql
-- Audit all activity by privileged users
CREATE AUDIT POLICY priv_user_activity
  ACTIONS ALL
  BY SYS, SYSTEM, PDBADMIN;

AUDIT POLICY priv_user_activity;

-- Audit specific high-risk accounts
CREATE AUDIT POLICY high_risk_accounts
  ACTIONS SELECT, INSERT, UPDATE, DELETE, EXECUTE
  BY hr_admin, fin_admin, security_admin;

AUDIT POLICY high_risk_accounts;
```

### Pillar 2 — Security-Relevant Events

Security-relevant events are actions within the database that warrant greater scrutiny and constant monitoring because they can potentially be abused. Monitoring such actions helps detect anomalous activities in the database. These actions include, but are not limited to, any changes in the database-wide security policies using ALTER DATABASE/ALTER SYSTEM.

```sql
-- Audit all security-management events
CREATE AUDIT POLICY security_events
  ACTIONS
    ALTER SYSTEM,
    ALTER DATABASE,
    CREATE USER, ALTER USER, DROP USER,
    GRANT, REVOKE,
    CREATE ROLE, ALTER ROLE, DROP ROLE,
    CREATE AUDIT POLICY,
    ALTER AUDIT POLICY,
    DROP AUDIT POLICY,
    AUDIT, NOAUDIT;

AUDIT POLICY security_events;
```

### Pillar 3 — Sensitive Data Access

```sql
-- Audit access to tables containing sensitive data
CREATE AUDIT POLICY sensitive_data_access
  ACTIONS
    SELECT ON hr.employees,
    INSERT ON hr.employees,
    UPDATE ON hr.employees,
    DELETE ON hr.employees,
    SELECT ON fin.salary_history,
    SELECT ON fin.bank_accounts;

AUDIT POLICY sensitive_data_access;
```

---

## Mandatory Auditing — Always On

Oracle Database has mandatory auditing enabled for certain security-sensitive operations. These always-on audits are built in and cannot be turned off. So you don't need to duplicate them in your own policies.

```sql
-- View all mandatory audit records
SELECT event_timestamp, dbusername, action_name, object_name, return_code
FROM UNIFIED_AUDIT_TRAIL
WHERE UNIFIED_AUDIT_POLICIES LIKE '%ORA$MANDATORY%'
ORDER BY event_timestamp DESC;
```

Mandatory audit events include SYSDBA and SYSOPER logins, database startup and shutdown, and connections using administrative privileges.

---

## Predefined Oracle Audit Policies

Oracle provides several predesigned and ready-to-use best practice unified audit policies that cover common security-relevant audit settings. These include audits of failed logons and logoffs, changes to Oracle Database parameter settings, modifications to user accounts and privileges, and audit requirements for STIG compliance.

```sql
-- View all predefined Oracle policies
SELECT policy_name, enabled_option, user_name
FROM audit_unified_enabled_policies
WHERE policy_name LIKE 'ORA$%'
ORDER BY policy_name;

-- Key predefined policies
-- ORA$LOGON_FAILURES    -- Failed login attempts
-- ORA$ALL_TOPLEVEL_ACTIONS -- All top-level SQL (use carefully)
-- ORA$DATABASE_PARAMETER_CHANGES -- ALTER SYSTEM changes
-- ORA$ACCOUNT_MGMT     -- User account changes
-- ORA$STIG_RECOMMENDATIONS -- STIG compliance requirements

-- Enable the logon failures policy
AUDIT POLICY ORA$LOGON_FAILURES;

-- Enable STIG recommendations
AUDIT POLICY ORA$STIG_RECOMMENDATIONS;
```

---

## Creating Custom Audit Policies

### Basic Policy Syntax

```sql
-- Syntax
CREATE AUDIT POLICY policy_name
  PRIVILEGES privilege1, privilege2, ...
  ACTIONS action1 ON schema.object, action2, ...
  ROLES role1, role2
  WHEN 'condition'
  EVALUATE PER SESSION | INSTANCE | STATEMENT;

-- Enable the policy
AUDIT POLICY policy_name;

-- Enable for specific users only
AUDIT POLICY policy_name BY user1, user2;

-- Enable for all users EXCEPT specific ones
AUDIT POLICY policy_name EXCEPT user1, user2;

-- Disable a policy
NOAUDIT POLICY policy_name;

-- Drop a policy
DROP AUDIT POLICY policy_name;
```

### Audit Failed Logins

```sql
CREATE AUDIT POLICY failed_logins
  ACTIONS LOGON
  WHEN 'SYS_CONTEXT(''USERENV'', ''SESSION_USER'') IS NOT NULL'
  EVALUATE PER SESSION;

-- Or more simply using the predefined policy
AUDIT POLICY ORA$LOGON_FAILURES;
```

### Audit DDL on Critical Objects

```sql
CREATE AUDIT POLICY critical_ddl
  ACTIONS
    ALTER TABLE ON hr.employees,
    DROP TABLE ON hr.employees,
    TRUNCATE TABLE ON hr.employees,
    ALTER TABLE ON fin.accounts,
    DROP TABLE ON fin.accounts;

AUDIT POLICY critical_ddl;
```

### Audit Privilege Use

```sql
CREATE AUDIT POLICY privilege_use
  PRIVILEGES
    CREATE ANY TABLE,
    DROP ANY TABLE,
    SELECT ANY TABLE,
    EXECUTE ANY PROCEDURE,
    CREATE ANY PROCEDURE,
    ALTER ANY TABLE;

AUDIT POLICY privilege_use;
```

---

## Column-Level Auditing — New in 23ai

Oracle Database 23ai introduces a new ability to audit access to certain columns in tables and views. It enables you to create more narrowly targeted audit policies that reduce "noise" from unnecessary audit records.

This is one of the most impactful new auditing features in 23ai. Instead of auditing every SELECT on a table, you can audit only when specific sensitive columns are accessed — dramatically reducing audit volume while increasing precision.

```sql
-- Audit access to specific PII columns only
CREATE AUDIT POLICY pii_column_access
  ACTIONS
    SELECT (salary, ssn, bank_account) ON hr.employees,
    UPDATE (salary, ssn, bank_account) ON hr.employees,
    INSERT (salary, ssn, bank_account) ON hr.employees;

AUDIT POLICY pii_column_access;
```

Before 23ai, a policy on `hr.employees` would fire on every single SELECT regardless of which columns were accessed. With column-level auditing, the policy only fires when someone actually touches `salary`, `ssn`, or `bank_account` — reducing audit noise by orders of magnitude on busy tables.

---

## Conditional Auditing

With conditional auditing, you can create precise, highly selective and context-aware policies, which makes it easier to audit specific actions and reduce the amount of irrelevant audit records. Conditional audits lower your storage needs and provide high-value audit records that will be useful for auditors, forensic investigations, or regulatory compliance requirements.

```sql
-- Audit SELECT on salary only outside business hours
CREATE AUDIT POLICY after_hours_salary_access
  ACTIONS SELECT (salary) ON hr.employees
  WHEN 'TO_NUMBER(TO_CHAR(SYSDATE, ''HH24'')) NOT BETWEEN 8 AND 18'
  EVALUATE PER STATEMENT;

AUDIT POLICY after_hours_salary_access;

-- Audit only connections from outside the corporate network
CREATE AUDIT POLICY external_access
  ACTIONS ALL
  WHEN 'SYS_CONTEXT(''USERENV'', ''IP_ADDRESS'')
        NOT LIKE ''10.%'''
  EVALUATE PER SESSION;

AUDIT POLICY external_access;

-- Audit only failed DML attempts
CREATE AUDIT POLICY failed_dml
  ACTIONS INSERT, UPDATE, DELETE ON hr.employees
  WHEN 'SYS_CONTEXT(''USERENV'', ''CURRENT_USER'') != ''HR_APP'''
  EVALUATE PER STATEMENT;

AUDIT POLICY failed_dml WHENEVER NOT SUCCESSFUL;
```

---

## Capturing Application Context

The unified audit trail can be extended to include application attributes by configuring auditing for application context values. The application context namespace can be populated with the required attributes, and this is captured in the APPLICATION_CONTEXTS column of the unified audit trail.

This is invaluable for applications that use connection pools — many users share the same database user, making it impossible to tell from `DBUSERNAME` alone who actually performed an action. Application context solves this.

```sql
-- In your application, set the context before each operation
EXEC DBMS_SESSION.SET_CONTEXT(
  namespace => 'APP_CTX',
  attribute => 'APP_USER',
  value     => 'john.smith@company.com'
);

EXEC DBMS_SESSION.SET_CONTEXT(
  namespace => 'APP_CTX',
  attribute => 'MODULE',
  value     => 'PAYROLL_PROCESSING'
);

-- Create an audit policy that captures the context
CREATE AUDIT POLICY app_user_activity
  ACTIONS INSERT, UPDATE, DELETE ON hr.employees;

AUDIT POLICY app_user_activity;

-- The APPLICATION_CONTEXTS column in UNIFIED_AUDIT_TRAIL
-- will now capture app_user and module for every audit record
SELECT
  event_timestamp,
  dbusername,
  application_contexts,
  action_name,
  object_name
FROM UNIFIED_AUDIT_TRAIL
WHERE object_name = 'EMPLOYEES'
ORDER BY event_timestamp DESC;
```

---

## PDB-Level Auditing

Oracle 23ai provides PDB autonomy — fully independent audit policies at the PDB level. Each PDB can have its own audit policies, its own audit trail, and its own retention settings — independent of the CDB or other PDBs.

```sql
-- Connect to a specific PDB
ALTER SESSION SET CONTAINER = FREEPDB1;

-- All audit policy operations here affect only FREEPDB1
CREATE AUDIT POLICY pdb_sensitive_access
  ACTIONS SELECT ON app_schema.customers,
           SELECT ON app_schema.orders;

AUDIT POLICY pdb_sensitive_access;

-- Query audit trail for this PDB only
SELECT event_timestamp, dbusername, action_name, object_name
FROM UNIFIED_AUDIT_TRAIL
WHERE dbid = (SELECT dbid FROM v$database)
ORDER BY event_timestamp DESC;
```

---

## Querying the Audit Trail

### Basic Queries

```sql
-- All audit records in the last 24 hours
SELECT event_timestamp, dbusername, action_name,
       object_schema, object_name, return_code
FROM UNIFIED_AUDIT_TRAIL
WHERE event_timestamp > SYSDATE - 1
ORDER BY event_timestamp DESC;

-- Failed login attempts
SELECT event_timestamp, dbusername, userhost,
       os_username, return_code
FROM UNIFIED_AUDIT_TRAIL
WHERE action_name = 'LOGON'
  AND return_code != 0
ORDER BY event_timestamp DESC;

-- All activity by a specific user today
SELECT event_timestamp, action_name, object_schema,
       object_name, sql_text
FROM UNIFIED_AUDIT_TRAIL
WHERE dbusername = 'HR_ADMIN'
  AND event_timestamp > TRUNC(SYSDATE)
ORDER BY event_timestamp;

-- DDL changes in the last 7 days
SELECT event_timestamp, dbusername, action_name,
       object_schema, object_name
FROM UNIFIED_AUDIT_TRAIL
WHERE action_name IN ('CREATE TABLE','DROP TABLE','ALTER TABLE',
                      'CREATE USER','DROP USER','GRANT','REVOKE')
  AND event_timestamp > SYSDATE - 7
ORDER BY event_timestamp DESC;

-- Which policies are generating the most records
SELECT unified_audit_policies, COUNT(*) AS record_count
FROM UNIFIED_AUDIT_TRAIL
WHERE event_timestamp > SYSDATE - 30
GROUP BY unified_audit_policies
ORDER BY record_count DESC;
```

### Managing Audit Policies

```sql
-- View all audit policies
SELECT policy_name, enabled_option, success, failure
FROM audit_unified_policies
ORDER BY policy_name;

-- View currently enabled policies
SELECT policy_name, enabled_option, user_name, success, failure
FROM audit_unified_enabled_policies
ORDER BY policy_name;

-- View policy details
SELECT policy_name, audit_option, audit_option_type,
       object_schema, object_name, object_type
FROM audit_unified_policies
WHERE policy_name = 'PII_COLUMN_ACCESS'
ORDER BY audit_option;
```

---

## Audit Trail Maintenance

### Archiving Audit Records

Oracle recommends archiving audit records regularly before purging to maintain a historical record for compliance purposes:

```sql
-- Create an archive table
CREATE TABLE audit_archive AS
SELECT * FROM UNIFIED_AUDIT_TRAIL WHERE 1=0;

-- Archive records older than 90 days
INSERT INTO audit_archive
SELECT * FROM UNIFIED_AUDIT_TRAIL
WHERE event_timestamp < SYSDATE - 90;

COMMIT;
```

### Purging the Audit Trail

```sql
-- Initialize the audit trail cleanup
BEGIN
  DBMS_AUDIT_MGMT.INIT_CLEANUP(
    audit_trail_type         => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED,
    default_cleanup_interval => 24  -- hours
  );
END;
/

-- Set the last archive timestamp
BEGIN
  DBMS_AUDIT_MGMT.SET_LAST_ARCHIVE_TIMESTAMP(
    audit_trail_type  => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED,
    last_archive_time => SYSDATE - 90
  );
END;
/

-- Run the purge manually
BEGIN
  DBMS_AUDIT_MGMT.CLEAN_AUDIT_TRAIL(
    audit_trail_type    => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED,
    use_last_arch_timestamp => TRUE
  );
END;
/

-- Schedule automatic purge every 24 hours
BEGIN
  DBMS_AUDIT_MGMT.CREATE_PURGE_JOB(
    audit_trail_type           => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED,
    audit_trail_purge_interval => 24,
    audit_trail_purge_name     => 'UNIFIED_AUDIT_PURGE_JOB',
    use_last_arch_timestamp    => TRUE
  );
END;
/
```

---

## Compliance Framework Mapping

### GDPR

```sql
-- Audit access to personal data columns
CREATE AUDIT POLICY gdpr_pii_access
  ACTIONS
    SELECT (first_name, last_name, email, phone,
            address, date_of_birth, national_id) ON customers.profiles,
    UPDATE (first_name, last_name, email, phone,
            address, date_of_birth, national_id) ON customers.profiles,
    DELETE ON customers.profiles;

AUDIT POLICY gdpr_pii_access;
```

### SOX (Sarbanes-Oxley)

```sql
-- Audit all financial data access and changes
CREATE AUDIT POLICY sox_financial_audit
  ACTIONS
    SELECT ON fin.general_ledger,
    INSERT ON fin.general_ledger,
    UPDATE ON fin.general_ledger,
    DELETE ON fin.general_ledger,
    SELECT ON fin.journal_entries,
    INSERT ON fin.journal_entries,
    ALTER TABLE ON fin.general_ledger,
    ALTER TABLE ON fin.journal_entries;

AUDIT POLICY sox_financial_audit;

-- Audit privilege changes (SOX requires tracking who can do what)
CREATE AUDIT POLICY sox_privilege_changes
  ACTIONS
    GRANT, REVOKE,
    CREATE USER, ALTER USER, DROP USER,
    CREATE ROLE, DROP ROLE;

AUDIT POLICY sox_privilege_changes;
```

### HIPAA

```sql
-- Audit all access to protected health information (PHI)
CREATE AUDIT POLICY hipaa_phi_access
  ACTIONS
    SELECT (patient_id, diagnosis, treatment,
            medication, insurance_id) ON health.patient_records,
    UPDATE (patient_id, diagnosis, treatment,
            medication, insurance_id) ON health.patient_records,
    INSERT ON health.patient_records,
    DELETE ON health.patient_records;

AUDIT POLICY hipaa_phi_access;
```

---

## Best Practices Summary

Based on Oracle's official best practice guidelines:

**Focus on three areas:**
Start with privileged user activity, then security-relevant events, then sensitive data access. Auditing everything creates too much noise and degrades performance.

**Use predefined policies first:**
Oracle's `ORA$` prefixed policies cover most common compliance requirements. Enable them before writing custom policies.

**Leverage column-level auditing (23ai):**
Instead of auditing entire table accesses, audit specific sensitive columns. This dramatically reduces audit volume on busy tables while maintaining precision.

**Use conditional auditing to reduce noise:**
Add `WHEN` conditions to policies so they only fire in relevant scenarios — after hours, from external IPs, on failed attempts.

**Never audit SYS directly in your policies:**
SYS activity is covered by mandatory auditing. Duplicating it wastes storage.

**Archive before purging:**
Always move audit records to an archive table before running `CLEAN_AUDIT_TRAIL`. Compliance frameworks typically require 1–7 years of audit history.

**Test policy impact before enabling in production:**
Enable new policies on a test system first and measure the audit record volume generated before deploying to production.

```sql
-- Verify your audit setup is complete
SELECT
  (SELECT COUNT(*) FROM audit_unified_enabled_policies) AS enabled_policies,
  (SELECT COUNT(*) FROM UNIFIED_AUDIT_TRAIL
   WHERE event_timestamp > SYSDATE - 1) AS records_last_24h,
  (SELECT value FROM v$parameter
   WHERE name = 'audit_trail') AS audit_trail_param;
```
