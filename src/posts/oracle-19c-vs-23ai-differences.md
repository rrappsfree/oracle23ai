---
layout: post.njk
title: "Key Differences Between Oracle 19c and 23ai"
description: "A detailed side-by-side comparison of Oracle Database 19c and 23ai across AI capabilities, SQL and PL/SQL, security, performance, architecture, developer experience, and support lifecycle — to help you decide when and whether to upgrade."
date: 2025-03-21
author: Oracle 23ai Help Team
readTime: 14 min
tag: Deep Dive
category: blog
templateEngineOverride: md
tags:
  - posts
  - comparison
  - upgrade
  - 19c
---

## Two Distinct Epochs

Oracle Database 19c and Oracle Database 23ai are both long-term support (LTS) releases, but they represent two fundamentally different philosophies about what a database should be.

Oracle 19c stands as the apex of traditional database optimization — a mature, stable, and highly refined platform focused on maximizing the performance, security, and availability of existing enterprise workloads. It is the terminal release of the 12c family, embodying a decade of enhancements in automation, in-memory processing, and security controls. In stark contrast, Oracle Database 23ai marks a strategic and technological inflection point.

Understanding the differences between them is the essential starting point for any upgrade decision.

---

## At a Glance

| Category | Oracle 19c | Oracle 23ai |
|----------|-----------|-------------|
| Release type | Long-Term Support (LTS) | Long-Term Support (LTS) |
| Release year | 2019 | 2024 (production) |
| Premier Support | Through April 2027 | Through December 31, 2031 |
| Extended Support | Through April 2030 | TBD |
| Architecture | Non-CDB or CDB/PDB | CDB/PDB only (non-CDB removed) |
| AI features | None native | AI Vector Search, DBMS_VECTOR |
| New features | Mature, stable | 300+ new features |
| Free edition | No | Yes — Oracle Database 23ai Free |
| Direct upgrade to | 21c or 23ai | N/A (current LTS) |

---

## Architecture: The Biggest Breaking Change

Oracle Database 23ai no longer supports the classic non-CDB architecture, requiring adoption of the CDB/PDB model introduced in 12.2. This change alone may well impact your ability to easily upgrade.

In Oracle 19c you could still create and run non-CDB databases — the classic architecture that dominated Oracle from version 1 through 11g. In 23ai that option is gone entirely.

| Aspect | Oracle 19c | Oracle 23ai |
|--------|-----------|-------------|
| Non-CDB support | Yes (deprecated but functional) | Removed entirely |
| CDB/PDB support | Yes | Yes (only option) |
| Max PDBs (Free/SE) | 3 user PDBs | Unlimited in Free edition |
| Non-CDB to PDB migration | Optional | Required before upgrading |

If you are running 19c non-CDB databases, converting to PDB is a mandatory prerequisite before upgrading to 23ai. The AutoUpgrade tool can handle this conversion automatically as part of the upgrade process.

---

## AI Capabilities

This is the most dramatic difference between the two releases — Oracle 23ai is the first release that heavily focuses on features for AI. That is also why Oracle decided to rename it from Database 23c to the more technically catchy Database 23ai.

| Feature | Oracle 19c | Oracle 23ai |
|---------|-----------|-------------|
| VECTOR data type | Not available | Native — `VECTOR(dims, format)` |
| Vector indexes | Not available | HNSW (in-memory) and IVF (disk) |
| Similarity search | Not available | `VECTOR_DISTANCE()` with 5 metrics |
| Embedding generation | External only | `DBMS_VECTOR.UTL_TO_EMBEDDING` |
| LLM integration | External only | `DBMS_VECTOR_CHAIN` (OCI, OpenAI, Cohere) |
| RAG pipelines | Application-tier only | Native SQL — no middleware required |
| Semantic search | Not available | `FETCH APPROXIMATE` with ANN indexes |

In Oracle 19c, building a semantic search or RAG application meant maintaining a separate vector database (Pinecone, pgvector, Chroma) alongside your Oracle instance. In 23ai, the vector store is Oracle itself — same ACID guarantees, same SQL interface, no sync overhead.

```sql
-- Oracle 23ai: semantic search in pure SQL
SELECT content, VECTOR_DISTANCE(embedding, :query_vec, COSINE) AS score
FROM documents
ORDER BY score
FETCH APPROXIMATE FIRST 10 ROWS ONLY;
```

---

## SQL and PL/SQL Developer Experience

Oracle 23ai removes a significant amount of boilerplate that 19c developers had to write daily.

### IF NOT EXISTS / IF EXISTS

```sql
-- Oracle 19c: error if table already exists
CREATE TABLE employees (...);
-- ORA-00955: name is already used by an existing object

-- Oracle 23ai: no error, no exception block needed
CREATE TABLE IF NOT EXISTS employees (...);
DROP TABLE IF EXISTS employees;
DROP INDEX IF EXISTS emp_idx;
```

### SELECT Without FROM DUAL

```sql
-- Oracle 19c
SELECT SYSDATE FROM dual;
SELECT 1 + 1 FROM dual;

-- Oracle 23ai
SELECT SYSDATE;
SELECT 1 + 1;
```

### GROUP BY Column Aliases

```sql
-- Oracle 19c: must repeat the expression
SELECT TRUNC(hire_date, 'MM') AS hire_month, COUNT(*)
FROM employees
GROUP BY TRUNC(hire_date, 'MM');

-- Oracle 23ai: use the alias directly
SELECT TRUNC(hire_date, 'MM') AS hire_month, COUNT(*)
FROM employees
GROUP BY hire_month;
```

### Boolean Data Type

```sql
-- Oracle 19c: no native BOOLEAN in SQL (PL/SQL only)
-- Workaround: NUMBER(1) or VARCHAR2(1) with 'Y'/'N'
CREATE TABLE flags (is_active NUMBER(1) CHECK (is_active IN (0,1)));

-- Oracle 23ai: native BOOLEAN in SQL
CREATE TABLE flags (is_active BOOLEAN);
INSERT INTO flags VALUES (TRUE);
SELECT * FROM flags WHERE is_active = TRUE;
```

### UPDATE and DELETE with JOIN

```sql
-- Oracle 19c: correlated subquery required
UPDATE employees e
SET salary = salary * 1.10
WHERE dept_id IN (
  SELECT dept_id FROM departments WHERE dept_name = 'Engineering'
);

-- Oracle 23ai: JOIN syntax directly
UPDATE employees e
  JOIN departments d ON e.dept_id = d.dept_id
SET e.salary = e.salary * 1.10
WHERE d.dept_name = 'Engineering';
```

### Additional SQL Enhancements in 23ai

| Feature | 19c | 23ai |
|---------|-----|------|
| `IF [NOT] EXISTS` DDL | No | Yes |
| `SELECT` without `FROM` | No | Yes |
| `BOOLEAN` SQL data type | No | Yes |
| `GROUP BY` aliases | No | Yes |
| `UPDATE`/`DELETE` with JOIN | No | Yes |
| SQL Domains | No | Yes |
| Annotations on objects | No | Yes |
| `INTERVAL` aggregation (SUM/AVG) | No | Yes |
| `CEIL`/`FLOOR` on DATE/TIMESTAMP | No | Yes |
| CASE expression improvements | Limited | Enhanced |
| `DEFAULT ON NULL FOR INSERT AND UPDATE` | No | Yes |

---

## Security

Oracle 23ai shifts the security posture from reactive detection to proactive prevention by embedding security deeper into the database kernel.

| Feature | Oracle 19c | Oracle 23ai |
|---------|-----------|-------------|
| SQL Firewall | Not available | Built into kernel — allow-list enforcement |
| Schema-level privileges | Not available | `GRANT SELECT ANY TABLE ON SCHEMA hr` |
| Immutable Tables | Backported from 21c | Enhanced with compliance controls |
| Blockchain Tables | Backported from 21c | Row-level signature verification enhanced |
| `GRANT ANY TABLE` scoping | Database-wide only | Can be scoped to a single schema |
| `DBA_SCHEMA_PRIVS` view | Not available | New — tracks schema privilege grants |

The SQL Firewall is arguably the most impactful security addition. It operates inside the database kernel, inspects every incoming SQL statement before execution, and blocks anything not on the pre-approved allow-list — regardless of what happens at the application tier.

```sql
-- 19c: no built-in SQL inspection
-- Application must implement its own input sanitization

-- 23ai: SQL Firewall inside the database
EXEC DBMS_SQL_FIREWALL.ENABLE;
EXEC DBMS_SQL_FIREWALL.START_CAPTURE(username => 'APP_USER');
-- ... run normal application workload ...
EXEC DBMS_SQL_FIREWALL.STOP_CAPTURE(username => 'APP_USER');
EXEC DBMS_SQL_FIREWALL.GENERATE_ALLOW_LIST(username => 'APP_USER');
EXEC DBMS_SQL_FIREWALL.ENABLE_ALLOW_LIST(
  username => 'APP_USER',
  enforce  => DBMS_SQL_FIREWALL.ENFORCE_SQL);
```

---

## Multi-Model Data Support

Oracle 19c introduced JSON support and had basic graph capabilities. Oracle 23ai expands both significantly and adds first-class vector support.

| Data model | Oracle 19c | Oracle 23ai |
|-----------|-----------|-------------|
| Relational | Full | Full |
| JSON | Supported — `IS JSON` constraint, dot notation | Enhanced — JSON Duality Views, JSON Collections, MongoDB API |
| Property Graph | PGQL (proprietary) | SQL/PGQ (ANSI standard) |
| Vector | Not available | Native VECTOR type with ANN indexes |
| Spatial | Supported | Enhanced |
| XML | Supported | Supported |
| Document store | SODA (limited) | MongoDB-compatible API |

JSON Relational Duality Views are the headline multi-model feature — they let you expose relational tables as updatable JSON documents without any data duplication.

```sql
-- 23ai: expose relational data as JSON — reads and writes both work
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW dept_dv AS
  departments @INSERT @UPDATE @DELETE
  { deptId: dept_id, deptName: dept_name,
    employees: employees @INSERT @UPDATE @DELETE
    [{ empId: emp_id, empName: emp_name }] };
```

---

## Performance

Both releases are highly capable for enterprise workloads. 23ai builds on 19c's foundation with several new capabilities.

| Feature | Oracle 19c | Oracle 23ai |
|---------|-----------|-------------|
| Automatic Indexing | Introduced | Enhanced — improved ML models |
| In-Memory Column Store | Supported | Enhanced |
| True Cache | Not available | New — read-only in-memory cache instance |
| Lock-Free Reservations | Not available | New — eliminates hot row contention |
| Priority Transactions | Not available | New — high-priority workload preemption |
| Vector index search | Not available | HNSW (sub-millisecond at scale) |
| Partition pruning for graphs | Not available | IVF local indexes on partitioned tables |

True Cache is worth highlighting — it is a separate lightweight Oracle instance that serves read queries from memory, offloading the primary database without Oracle RAC licensing.

---

## DBA and Operations

| Feature | Oracle 19c | Oracle 23ai |
|---------|-----------|-------------|
| `DB_DEVELOPER_ROLE` | Not available | New predefined role for developers |
| AutoUpgrade tool | Available | Enhanced — handles non-CDB to PDB conversion |
| SQL Analysis Report | Not available | New — detects anti-patterns at dev time |
| RMAN immutable backups | Not available | New — on OCI Object Storage |
| Data Pump monitoring views | Limited | 3 new `V$DATAPUMP_*` views |
| Bigfile tablespace default | Smallfile default | Bigfile is now the default |
| `DBMS_SPACE.SHRINK_TABLESPACE` | Not available | New — reclaim bigfile space |
| TNS error messages | Cryptic (ORA-12541) | Detailed cause-and-action guidance |
| `DBMS_HCHECK` | Not available | New — data dictionary health checks |

The `DB_DEVELOPER_ROLE` is a significant quality-of-life improvement. In 19c environments it was common to grant `DBA` to developers just to avoid repeated privilege requests. 23ai provides a curated role with everything a developer needs and nothing they don't.

---

## Free Edition Comparison

| | Oracle 19c | Oracle 23ai Free |
|-|-----------|-----------------|
| Free edition available | No | Yes |
| CPU threads | N/A | 2 |
| RAM | N/A | 2 GB |
| User data | N/A | 12 GB |
| AI Vector Search | N/A | Included |
| JSON Duality Views | N/A | Included |
| SQL Firewall | N/A | Included |
| License required | Yes | No |

Every 23ai feature — including AI Vector Search — is available in the free edition. This makes 23ai accessible to any developer or DBA who wants to evaluate the new capabilities without any licensing cost.

---

## Support Lifecycle

While 19c's Premier Support ends in 2029 (and Extended Support in 2032), upgrading now guarantees longer coverage, access to new AI features, and continued security updates.

| | Oracle 19c | Oracle 23ai |
|-|-----------|------------|
| Premier Support end | April 2027 | December 31, 2031 |
| Extended Support end | April 2030 | TBD |
| Remaining Premier years (from 2025) | ~2 years | ~6 years |

With only about two years of Premier Support remaining for 19c, planning your upgrade path to 23ai now is prudent — especially given that transitioning to Oracle Database 23ai could potentially take two to three years, pending the project is successful, especially if navigating a complex multi-upgrade path.

---

## Should You Upgrade?

The decision depends on your workload and timeline — but the direction is clear.

**Upgrade to 23ai if:**
- You are building or planning AI-driven applications (semantic search, RAG, recommendations)
- Your team wants the SQL developer improvements (IF NOT EXISTS, BOOLEAN, SQL Domains)
- You need SQL Firewall for compliance (PCI-DSS, SOC 2, financial services)
- Your 19c Premier Support window is closing
- You want the longest possible support runway (6+ years of Premier Support)

**Stay on 19c for now if:**
- Your workload is stable and has no immediate AI requirements
- You are mid-way through a complex application re-certification cycle
- You are running non-CDB and haven't planned the PDB migration yet
- Achieving a stable release typically takes time, often at least two years — the version you've archived may not be stable enough for critical production workloads yet

**Either way — start planning now.** The non-CDB to PDB migration is the step that catches most teams off-guard. Even if you plan to stay on 19c for another year, completing that architectural migration now removes the biggest blocker when you are ready to move to 23ai.

---

## Migration Quick Reference

```bash
# Check your upgrade path
java -jar preupgrade.jar FILE TEXT DIR /tmp/preupgrade

# Run AutoUpgrade analyze mode (no changes)
java -jar autoupgrade.jar -config upgrade.cfg -mode analyze

# Check non-CDB status
sqlplus / as sysdba
SQL> SELECT cdb FROM v$database;
-- CDB = NO means you are running non-CDB and must convert first

# Create a guaranteed restore point before upgrading
SQL> CREATE RESTORE POINT before_23ai GUARANTEE FLASHBACK DATABASE;
```

For the full step-by-step upgrade walkthrough, see the [Upgrading from Oracle 19c to 23ai](/install/upgrading-19c-to-23ai/) guide.
