---
layout: post.njk
title: "Schema Privileges: The End of GRANT-ALL Anti-Patterns"
description: "Oracle 23ai introduces schema-level privileges — a long-awaited middle tier between granting access to a single object and granting access to everything. Here's why it matters, how it works, and how to migrate away from the GRANT ANY anti-pattern."
date: 2025-01-31
author: Oracle 23ai Help Team
readTime: 10 min
tag: Security
category: blog
tags:
  - posts
  - security
  - privileges
  - dba
---

## The Problem with Pre-23ai Privilege Management

Before Oracle 23ai, DBAs managing application access had exactly two options when a service account needed to query a schema:

**Option 1 — Grant on each individual object**

```sql
GRANT SELECT ON hr.employees    TO app_user;
GRANT SELECT ON hr.departments  TO app_user;
GRANT SELECT ON hr.jobs         TO app_user;
GRANT SELECT ON hr.locations    TO app_user;
-- ... repeat for every table and view in the schema
```

This is correct from a security standpoint but becomes a maintenance nightmare the moment a new table is added. Every new object requires a new grant. Scripts drift. Service accounts end up missing access to new tables and applications break in production.

**Option 2 — Grant ANY privilege**

```sql
GRANT SELECT ANY TABLE TO app_user;
```

One line. Problem solved — until it isn't. This grants the service account read access to **every table in the entire database**, including tables in SYS, SYSTEM, and every other schema. If this user account is compromised, your entire database can be compromised. It also violates the principle of least privilege and most compliance frameworks (PCI-DSS, SOC 2, ISO 27001) outright.

Object privileges have always worked on two tiers only — you get access to a single object, or you get access to every object. However, in the real world of database usage, we generally work in three tiers. Some people need access to objects on an individual basis, some people need access to all objects, but there is a common third tier that sits between these two: the schema.

Oracle 23ai finally closes this gap.

---

## Schema Privileges — The Missing Middle Tier

Oracle Database 23ai introduces a new schema-level grant. If you `GRANT SELECT ANY TABLE ON SCHEMA HR TO BOB`, that user can see all the tables and views in the HR schema — and only in the HR schema.

```sql
-- Before 23ai: dangerous broad grant
GRANT SELECT ANY TABLE TO app_user;

-- Oracle 23ai: scoped to one schema only
GRANT SELECT ANY TABLE ON SCHEMA hr TO app_user;
```

Same `ANY` keyword — but with `ON SCHEMA hr` appended, the privilege is now scoped entirely to the `hr` schema. The user cannot access any other schema.

### Future Objects Are Covered Automatically

If a new table is added to the schema, they instantly have access to that new table. No extra management is needed, and you continue to support a least-privilege security model with appropriate separation of duties.

```sql
-- Grant schema privilege once
GRANT SELECT ANY TABLE ON SCHEMA hr TO app_user;

-- Create a new table months later
CREATE TABLE hr.salary_bands (
  band_id    NUMBER PRIMARY KEY,
  band_name  VARCHAR2(50),
  min_salary NUMBER,
  max_salary NUMBER
);

-- app_user can already query it — no additional grant needed
SELECT * FROM hr.salary_bands; -- works immediately
```

This eliminates the entire class of "new table, forgot to grant" production incidents.

---

## Supported Privilege Types

Many system privileges can be scoped to a schema using `ON SCHEMA`. The most commonly used ones are:

| Privilege | Use case |
|-----------|---------|
| `SELECT ANY TABLE` | Read access to all tables and views in the schema |
| `INSERT ANY TABLE` | Insert rows into any table in the schema |
| `UPDATE ANY TABLE` | Update rows in any table in the schema |
| `DELETE ANY TABLE` | Delete rows from any table in the schema |
| `EXECUTE ANY PROCEDURE` | Execute all procedures and functions in the schema |
| `CREATE ANY TABLE` | Create tables within the schema |
| `ALTER ANY TABLE` | Alter table definitions in the schema |
| `DROP ANY TABLE` | Drop tables in the schema |
| `SELECT ANY SEQUENCE` | Read sequences in the schema |
| `READ ANY TABLE` | Read-only access (alternative to SELECT for some contexts) |

You can combine multiple privileges in a single grant:

```sql
-- Grant full DML access on the hr schema
GRANT SELECT ANY TABLE,
      INSERT ANY TABLE,
      UPDATE ANY TABLE,
      DELETE ANY TABLE
ON SCHEMA hr TO app_user;
```

### What is NOT covered by SELECT ANY TABLE

Testing by the community has confirmed one important nuance: `SELECT ANY TABLE ON SCHEMA` includes views but not sequences. Selecting from a sequence requires a separate `SELECT ANY SEQUENCE ON SCHEMA` grant.

```sql
-- Works — tables and views are included
SELECT * FROM hr.employees;
SELECT * FROM hr.emp_details_view;

-- Fails — sequences need a separate grant
SELECT hr.departments_seq.nextval FROM dual;
-- ORA-41900: missing READ privilege on "HR"."DEPARTMENTS_SEQ"

-- Fix
GRANT SELECT ANY SEQUENCE ON SCHEMA hr TO app_user;
```

### Privileges that cannot be schema-scoped

Not all system privileges support the `ON SCHEMA` clause. Privileges that apply to the database as a whole (such as `CREATE SESSION`, `CREATE TABLESPACE`, `ALTER DATABASE`) cannot be scoped to a schema — they are database-wide by nature.

---

## Granting Schema Privileges to Roles

Schema privileges can be granted to roles, not just users. This fits cleanly into an existing role-based access control model:

```sql
-- Create a read-only role for the HR schema
CREATE ROLE hr_readonly;
GRANT SELECT ANY TABLE ON SCHEMA hr TO hr_readonly;
GRANT SELECT ANY SEQUENCE ON SCHEMA hr TO hr_readonly;

-- Grant the role to users who need read access
GRANT hr_readonly TO alice;
GRANT hr_readonly TO reporting_service;

-- Grant the role to an application service account
GRANT hr_readonly TO hr_app_user;
```

Now when a new table is added to `hr`, every user and service account holding `hr_readonly` automatically gains access — without touching any grant statements.

---

## The WITH ADMIN OPTION

You can grant schema privileges with `ADMIN OPTION`, which allows the grantee to further grant the privilege to others.

```sql
-- Grant with admin option
GRANT SELECT ANY TABLE ON SCHEMA hr TO team_lead WITH ADMIN OPTION;

-- team_lead can now grant to others
GRANT SELECT ANY TABLE ON SCHEMA hr TO junior_dev;
```

Use `WITH ADMIN OPTION` carefully — it creates a chain of trust that can be hard to audit. Reserve it for schema owners and senior DBAs.

---

## Who Can Grant Schema Privileges?

Users can grant schema-level privileges on their own schema without having any special privileges. To grant schema-level privileges on someone else's schema, you need either the `GRANT ANY SCHEMA` or `GRANT ANY PRIVILEGE` system privilege.

```sql
-- Schema owner can grant on their own schema freely
CONN hr_owner/password@FREEPDB1
GRANT SELECT ANY TABLE ON SCHEMA hr TO app_user; -- works

-- DBA granting on another user's schema
CONN / AS SYSDBA
GRANT SELECT ANY TABLE ON SCHEMA hr TO app_user; -- also works
```

---

## Querying Schema Privilege Grants

Schema privilege grants do not show up in the well-known dictionary views `DBA_SYS_PRIVS`, `DBA_TAB_PRIVS`, or `DBA_ROLE_PRIVS`. Oracle 23ai introduces dedicated views for schema privileges:

| View | Shows |
|------|-------|
| `DBA_SCHEMA_PRIVS` | All schema privilege grants in the database |
| `USER_SCHEMA_PRIVS` | Schema privileges granted to the current user |
| `ROLE_SCHEMA_PRIVS` | Schema privileges granted to roles |
| `SESSION_SCHEMA_PRIVS` | Schema privileges active in the current session |

```sql
-- See all schema privilege grants
SELECT grantee, privilege, schema, admin_option
FROM DBA_SCHEMA_PRIVS
ORDER BY schema, grantee;

-- Check what a specific user has
SELECT privilege, schema
FROM DBA_SCHEMA_PRIVS
WHERE grantee = 'APP_USER';

-- Check what roles carry schema privileges
SELECT role, privilege, schema
FROM ROLE_SCHEMA_PRIVS;
```

---

## Revoking Schema Privileges

Revocation is as clean as the grant:

```sql
-- Revoke a single privilege
REVOKE SELECT ANY TABLE ON SCHEMA hr FROM app_user;

-- Revoke multiple privileges
REVOKE INSERT ANY TABLE, UPDATE ANY TABLE, DELETE ANY TABLE
ON SCHEMA hr FROM app_user;

-- Revoke from a role
REVOKE SELECT ANY TABLE ON SCHEMA hr FROM hr_readonly;
```

The schema-level privilege is not additive/subtractive — revoking an individual object privilege does not remove the schema-level privilege. The schema privilege remains in place and the user retains access through it.

This means if you want to block a user from a specific table inside a schema they have schema-level access to, revoking the individual object grant is not enough. You must revoke the schema privilege and re-grant individual object privileges, or use Virtual Private Database (VPD) policies to restrict row-level access.

---

## Migrating from Legacy GRANT ANY

If your environment currently uses `GRANT SELECT ANY TABLE` without a schema scope, here is a safe migration path:

### Step 1 — Audit current ANY grants

```sql
-- Find all users with unscoped ANY privileges
SELECT grantee, privilege
FROM DBA_SYS_PRIVS
WHERE privilege LIKE '%ANY TABLE%'
  AND grantee NOT IN ('SYS', 'SYSTEM', 'DBA')
ORDER BY grantee;
```

### Step 2 — Identify which schemas each grantee actually uses

```sql
-- Check actual table access over the past 30 days (requires auditing enabled)
SELECT db_user, obj_schema, COUNT(*) AS access_count
FROM DBA_AUDIT_TRAIL
WHERE action_name = 'SELECT'
  AND timestamp > SYSDATE - 30
GROUP BY db_user, obj_schema
ORDER BY db_user, access_count DESC;
```

### Step 3 — Replace broad grants with schema-scoped grants

```sql
-- Revoke the dangerous broad grant
REVOKE SELECT ANY TABLE FROM app_user;

-- Replace with schema-scoped grants for each schema actually needed
GRANT SELECT ANY TABLE ON SCHEMA hr     TO app_user;
GRANT SELECT ANY TABLE ON SCHEMA orders TO app_user;
```

### Step 4 — Verify nothing broke

```sql
-- Confirm the new grants are in place
SELECT grantee, privilege, schema
FROM DBA_SCHEMA_PRIVS
WHERE grantee = 'APP_USER';

-- Confirm the old broad grant is gone
SELECT grantee, privilege
FROM DBA_SYS_PRIVS
WHERE grantee = 'APP_USER'
  AND privilege LIKE '%ANY%';
```

---

## Limitations to Know

Schema privileges cannot be granted for the SYS schema. Attempting to do so returns an error — which is intentional and correct.

```sql
-- This will fail — SYS schema cannot be used with schema privileges
GRANT SELECT ANY TABLE ON SCHEMA SYS TO app_user;
-- ORA-65155: operation not allowed on SYS schema
```

If your application needs access to SYS-owned views (such as `V$SESSION` or `DBA_TABLES`), grant those individually as you always have:

```sql
GRANT SELECT ON SYS.V_$SESSION TO app_user;
GRANT SELECT ON SYS.DBA_TABLES  TO app_user;
```

Also note that if a user needs access to only a subset of tables in a schema, schema-level privileges are not appropriate — the user will gain access to the whole schema. In that case, continue using individual object grants or a curated role.

---

## Summary

Schema privileges in Oracle 23ai fill a decade-long gap in Oracle's privilege model. The before and after is stark:

| Scenario | Before 23ai | Oracle 23ai |
|----------|------------|-------------|
| Grant read access to all tables in `hr` | 1 grant per table + maintain on every new table | `GRANT SELECT ANY TABLE ON SCHEMA hr TO user` |
| New table added to `hr` | Manual grant required | Automatic — no action needed |
| Scope a system privilege to one schema | Not possible | `ON SCHEMA schema_name` clause |
| Avoid `GRANT ANY` security risk | Choose: manual or insecure | Schema-scoped — least privilege without maintenance overhead |
| Audit schema privilege grants | `DBA_SYS_PRIVS` (flat list) | `DBA_SCHEMA_PRIVS` (schema-aware) |

For any Oracle 23ai environment running multi-schema applications with service accounts, replacing `GRANT ANY` with schema-scoped grants should be one of the first security improvements you make.
