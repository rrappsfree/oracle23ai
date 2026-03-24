---
layout: post.njk
title: "Oracle 23ai New Features: Everything You Need to Know"
description: "A comprehensive overview of Oracle Database 23ai's 300+ new features — from AI Vector Search and JSON Duality Views to SQL Firewall, Schema Privileges, True Cache, Property Graph, and developer quality-of-life improvements."
date: 2025-03-20
author: Oracle 23ai Help Team
readTime: 16 min
tag: Deep Dive
category: blog
templateEngineOverride: md
featured: true
tags:
  - posts
  - new-features
  - ai
  - overview
---

## What Is Oracle Database 23ai?

Oracle Database 23ai — originally named Oracle Database 23c before being rebranded to reflect its AI-first identity — was released on May 2, 2024. It is Oracle's latest long-term support (LTS) release, with Premier Support through December 31, 2031 and Extended Support beyond that.

It is not a routine version bump. Oracle 23ai ships with over 300 major new features plus thousands of smaller enhancements — the largest single release in Oracle's history. The name change from "23c" to "23ai" signals a fundamental repositioning: this is the first Oracle Database release where artificial intelligence is a core architectural principle, not an add-on.

This article covers the most impactful features across every category: AI, developer experience, security, performance, and DBA tooling.

---

## AI Vector Search — The Flagship Feature

AI Vector Search is the headline innovation of Oracle 23ai. It allows you to store vector embeddings natively inside the database using the new `VECTOR` data type, and query them using purpose-built SQL functions — eliminating the need for a separate vector database alongside your relational data.

### The VECTOR Data Type

```sql
CREATE TABLE documents (
  id        NUMBER PRIMARY KEY,
  content   CLOB,
  embedding VECTOR(1536, FLOAT32)
);
```

The type signature is `VECTOR(dimensions, format)` where format can be `FLOAT32`, `FLOAT64`, `INT8`, or `BINARY`.

### Semantic Similarity Search

```sql
-- Find the 10 most semantically similar documents to a query
SELECT id, content,
       VECTOR_DISTANCE(embedding, :query_vec, COSINE) AS score
FROM documents
ORDER BY score
FETCH APPROXIMATE FIRST 10 ROWS ONLY;
```

Five distance metrics are supported: `COSINE`, `DOT`, `EUCLIDEAN`, `MANHATTAN`, and `HAMMING`.

### Vector Indexes

Two index types are available for approximate nearest-neighbour search:

```sql
-- HNSW: in-memory graph index, lowest latency
CREATE VECTOR INDEX docs_hnsw ON documents (embedding)
  ORGANIZATION INMEMORY NEIGHBOR GRAPH
  DISTANCE COSINE
  WITH TARGET ACCURACY 95;

-- IVF: disk-based partitioned index, large datasets
CREATE VECTOR INDEX docs_ivf ON documents (embedding)
  ORGANIZATION NEIGHBOR PARTITIONS
  DISTANCE COSINE
  WITH TARGET ACCURACY 95;
```

### AI Functions (DBMS_VECTOR)

Oracle 23ai includes `DBMS_VECTOR` — a PL/SQL package that integrates directly with external AI model providers (OCI Generative AI, OpenAI, Cohere, and others) to generate embeddings and run inference inside SQL:

```sql
-- Generate an embedding directly in SQL
SELECT DBMS_VECTOR.UTL_TO_EMBEDDING(
  'Oracle 23ai brings vector search natively into SQL',
  JSON('{"provider": "ocigenai", "credential_name": "OCI_CRED",
         "url": "https://inference.generativeai.../embed",
         "model": "cohere.embed-english-v3.0"}')
) FROM dual;
```

This makes it possible to build complete RAG (Retrieval-Augmented Generation) pipelines entirely within Oracle SQL — no Python middleware required.

---

## JSON Relational Duality Views

JSON Relational Duality Views are one of the most architecturally significant features of 23ai. They expose relational tables as JSON documents — and allow reads, inserts, updates, and deletes through the JSON view — without any data duplication.

```sql
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW dept_dv AS
  departments @INSERT @UPDATE @DELETE
  {
    deptId   : dept_id,
    deptName : dept_name,
    employees : employees @INSERT @UPDATE @DELETE
    [{ empId : emp_id, empName : emp_name }]
  };
```

One dataset, two faces. Your data lives in normalized relational tables. The duality view assembles it as JSON on the fly. Updates through the view write back to the underlying tables automatically with full ACID guarantees.

Every document includes an ETAG for built-in optimistic locking — safe for concurrent REST API clients without any extra application code.

---

## SQL Firewall

Oracle 23ai embeds a SQL Firewall directly into the database kernel. It inspects every incoming SQL statement before execution, enforcing user-specific allow-lists based on captured production workloads.

```sql
-- Enable the SQL Firewall
EXEC DBMS_SQL_FIREWALL.ENABLE;

-- Capture the allowed SQL workload for a user
EXEC DBMS_SQL_FIREWALL.START_CAPTURE(username => 'APP_USER');
-- ... let the application run its normal workload ...
EXEC DBMS_SQL_FIREWALL.STOP_CAPTURE(username => 'APP_USER');

-- Generate the allow-list from the captured workload
EXEC DBMS_SQL_FIREWALL.GENERATE_ALLOW_LIST(username => 'APP_USER');

-- Enable enforcement — SQL not in the allow-list is blocked
EXEC DBMS_SQL_FIREWALL.ENABLE_ALLOW_LIST(
  username => 'APP_USER',
  enforce  => DBMS_SQL_FIREWALL.ENFORCE_SQL);
```

SQL Firewall blocks SQL injection attacks, unauthorized ad-hoc queries, and lateral movement from compromised accounts — at the database level, regardless of application tier controls.

---

## Schema-Level Privileges

Before 23ai, granting access to a schema required either one grant per object (secure but unmaintainable) or `GRANT ANY TABLE` (one line but exposes the entire database). Oracle 23ai adds the missing middle tier:

```sql
-- Scoped to the HR schema only — not database-wide
GRANT SELECT ANY TABLE ON SCHEMA hr TO app_user;

-- New tables added to hr are automatically covered — no extra grants
CREATE TABLE hr.new_table (...);
-- app_user can already query hr.new_table
```

The `ON SCHEMA` clause works with `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `EXECUTE`, `CREATE`, `ALTER`, `DROP`, and more. New dictionary view `DBA_SCHEMA_PRIVS` tracks these grants.

---

## True Cache

True Cache is an in-memory read-only cache that sits between your application and the primary database. Unlike Oracle Database In-Memory (which caches inside the primary), True Cache runs as a separate lightweight instance:

```sql
-- Applications connect to True Cache using a standard connection string
-- True Cache intercepts read queries and serves them from memory
-- Write queries are automatically forwarded to the primary

-- Check True Cache status
SELECT name, value FROM v$parameter WHERE name LIKE 'true_cache%';
```

True Cache reduces primary database load by offloading read traffic, lowers latency for read-heavy workloads, and scales horizontally by deploying multiple cache instances without Oracle RAC licensing.

---

## Property Graph and SQL/PGQ

Oracle 23ai is the first commercial database to implement the new ANSI SQL/PGQ (Property Graph Queries) standard. It allows you to express graph traversals using familiar SQL syntax — no separate graph database needed.

```sql
-- Create a property graph over existing relational tables
CREATE PROPERTY GRAPH hr_graph
  VERTEX TABLES (employees, departments)
  EDGE TABLES (
    works_in SOURCE KEY (emp_id) REFERENCES employees
             DESTINATION KEY (dept_id) REFERENCES departments
  );

-- Query the graph using SQL/PGQ syntax
SELECT e.emp_name, d.dept_name
FROM GRAPH_TABLE (hr_graph
  MATCH (e IS employees) -[w IS works_in]-> (d IS departments)
  WHERE e.salary > 80000
  COLUMNS (e.emp_name, d.dept_name)
);
```

This is valuable for fraud detection, network analysis, recommendation engines, and supply chain graphs — all without leaving the Oracle database.

---

## Developer Quality-of-Life Improvements

Oracle 23ai includes dozens of SQL and PL/SQL enhancements that reduce boilerplate and remove long-standing frustrations.

### IF [NOT] EXISTS DDL

```sql
-- Before 23ai — errors if object already exists
CREATE TABLE employees (...);
-- ORA-00955: name is already used by an existing object

-- Oracle 23ai — no error, no complex exception handling needed
CREATE TABLE IF NOT EXISTS employees (...);
DROP TABLE IF EXISTS employees;
CREATE USER IF NOT EXISTS app_user IDENTIFIED BY password;
DROP INDEX IF EXISTS emp_idx;
```

### SELECT Without FROM

```sql
-- Before 23ai
SELECT SYSDATE FROM dual;
SELECT 1 + 2 FROM dual;
SELECT my_function() FROM dual;

-- Oracle 23ai
SELECT SYSDATE;
SELECT 1 + 2;
SELECT my_function();
```

`FROM dual` is no longer required for expressions that do not reference a table.

### SQL Domains

SQL Domains are reusable column definitions that encode business rules — data type, default value, constraints, and formatting — in one place:

```sql
-- Define the domain once
CREATE DOMAIN email_address AS VARCHAR2(255)
  CONSTRAINT email_chk CHECK (VALUE LIKE '%@%.%')
  DISPLAY UPPER(VALUE);

-- Use it across multiple tables
CREATE TABLE customers (
  id    NUMBER PRIMARY KEY,
  email email_address
);

CREATE TABLE employees (
  id    NUMBER PRIMARY KEY,
  email email_address
);
```

### GROUP BY Column Aliases

```sql
-- Before 23ai — must repeat the expression
SELECT TRUNC(hire_date, 'MM') AS hire_month, COUNT(*)
FROM employees
GROUP BY TRUNC(hire_date, 'MM');

-- Oracle 23ai — use the alias directly in GROUP BY
SELECT TRUNC(hire_date, 'MM') AS hire_month, COUNT(*)
FROM employees
GROUP BY hire_month;
```

### UPDATE and DELETE with JOIN

```sql
-- Oracle 23ai allows JOIN syntax in UPDATE and DELETE
UPDATE employees e
  JOIN departments d ON e.dept_id = d.dept_id
SET e.salary = e.salary * 1.10
WHERE d.dept_name = 'Engineering';

DELETE FROM employees e
  JOIN departments d ON e.dept_id = d.dept_id
WHERE d.location_id = 1700;
```

### Annotations

Annotations allow you to attach metadata directly to database objects — replacing the need for separate documentation tables or comments:

```sql
CREATE TABLE employees (
  id     NUMBER ANNOTATIONS (display_name 'Employee ID', required 'true'),
  name   VARCHAR2(100) ANNOTATIONS (display_name 'Full Name'),
  salary NUMBER ANNOTATIONS (display_name 'Annual Salary', pii 'true')
) ANNOTATIONS (description 'Core employee records table', owner 'HR Team');

-- Query annotations
SELECT column_name, annotation_name, annotation_value
FROM user_annotations_usage
WHERE object_name = 'EMPLOYEES';
```

---

## DB Developer Role

A new predefined role `DB_DEVELOPER_ROLE` bundles all the privileges a developer needs for application development — eliminating the common pattern of granting `DBA` to developers just to get things working:

```sql
-- Grant everything a developer needs in one line
GRANT DB_DEVELOPER_ROLE TO app_developer;
```

The role includes CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TYPE, CREATE TRIGGER, SELECT on data dictionary views, EXECUTE on common packages, and more — without any DBA-level privileges.

---

## Lock-Free Reservations

Lock-Free Reservations solve a long-standing contention problem for inventory and reservation systems. Without them, updating a shared counter (like available stock) requires a row lock that blocks all concurrent transactions:

```sql
-- Define a column as a reservation
CREATE TABLE inventory (
  product_id NUMBER PRIMARY KEY,
  quantity   NUMBER RESERVABLE CONSTRAINT qty_positive CHECK (quantity >= 0)
);

-- Concurrent reservations no longer block each other
UPDATE inventory
SET quantity = quantity - 1
WHERE product_id = 101;
-- This completes immediately without waiting for other sessions
```

Oracle 23ai handles the reservation logic internally, guaranteeing the constraint is never violated while eliminating lock contention on hot rows.

---

## Priority Transactions

Priority Transactions allow high-priority workloads to preempt lower-priority ones when resource contention occurs:

```sql
-- Mark a session as high priority
ALTER SESSION SET TRANSACTION PRIORITY = HIGH;

-- High-priority transactions can abort lower-priority conflicting transactions
-- Lower-priority sessions receive ORA-00060 and can retry
```

This is valuable for SLA-bound processes (payment processing, order capture) that must not be blocked by batch jobs or reporting queries.

---

## Automatic Indexing Enhancements

Oracle 23ai extends the Automatic Indexing feature introduced in 19c. The optimizer now learns query patterns and creates or drops indexes dynamically — without DBA involvement:

```sql
-- Enable automatic indexing
ALTER SYSTEM SET AUTO_INDEX_MODE = IMPLEMENT;

-- Monitor automatically created indexes
SELECT index_name, table_name, auto, status, last_analyzed
FROM dba_indexes
WHERE auto = 'YES';

-- Review the automatic indexing report
SELECT DBMS_AUTO_INDEX.REPORT_LAST_ACTIVITY() FROM dual;
```

---

## Immutable and Blockchain Tables — Enhanced

Immutable Tables prevent any modification or deletion of rows once inserted — without the distributed overhead of a blockchain:

```sql
CREATE IMMUTABLE TABLE audit_log (
  event_id   NUMBER PRIMARY KEY,
  event_time TIMESTAMP DEFAULT SYSTIMESTAMP,
  event_type VARCHAR2(50),
  details    CLOB
) NO DROP UNTIL 365 DAYS IDLE
  NO DELETE UNTIL 365 DAYS AFTER INSERT;
```

Oracle 23ai enhances Blockchain Tables with row-level signature verification and improved support for regulatory compliance frameworks including PCI-DSS and financial audit requirements.

---

## RMAN and Backup Enhancements

Oracle 23ai introduces significant backup and recovery improvements:

- **Immutable backups on OCI Object Storage** — backups cannot be deleted or modified, satisfying regulatory retention requirements
- **RMAN backup-based transport** — transport PDBs and tablespaces across platforms using RMAN backups without taking the source offline
- **Enhanced Data Pump views** — three new views (`V$DATAPUMP_PROCESS_INFO`, `V$DATAPUMP_PROCESSWAIT_INFO`, `V$DATAPUMP_SESSIONWAIT_INFO`) for real-time monitoring of import/export jobs

---

## Bigfile Tablespace as Default

Starting in Oracle 23ai, bigfile tablespaces are the default when creating new tablespaces — replacing smallfile tablespaces as the default. Oracle also introduces `DBMS_SPACE.SHRINK_TABLESPACE` to reclaim unused space in bigfile tablespaces:

```sql
-- Shrink a bigfile tablespace to reclaim unused space
EXEC DBMS_SPACE.SHRINK_TABLESPACE(tablespace_name => 'USERS');
```

---

## Enhanced TNS Error Messages

TNS error messages are significantly improved in 23ai. Where 19c might return a cryptic `ORA-12541: TNS: no listener`, 23ai returns detailed cause-and-action guidance including the specific host, port, and service name that failed, plus recommended diagnostic steps.

---

## Support Lifecycle

| Edition | Premier Support | Extended Support |
|---------|----------------|-----------------|
| Oracle 23ai | Through Dec 31, 2031 | TBD |
| Oracle 19c | Through April 2024 | Through April 2027 |

Oracle 23ai is the recommended upgrade target for all Oracle 19c customers. Customers with active support contracts upgrade at no additional license cost.

---

## Where to Start

If you are new to Oracle 23ai the recommended learning path is:

1. **Install Oracle 23ai Free** — runs on Linux, Windows, and Docker at no cost
2. **Try AI Vector Search** — create a VECTOR column and run your first semantic search
3. **Explore JSON Duality Views** — expose an existing table as a REST/JSON API
4. **Enable SQL Firewall** — capture and enforce your application's SQL allow-list
5. **Migrate schema grants** — replace `GRANT ANY TABLE` with `ON SCHEMA` grants

All of these features are available in the free edition with no license required.
