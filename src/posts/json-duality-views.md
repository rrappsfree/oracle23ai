---
layout: post.njk
title: "JSON Relational Duality Views: Bridging Relational and Document Worlds"
description: "Oracle 23ai's JSON Duality Views let you work with relational data as JSON documents — and back again — without duplication, without syncing, and without compromise."
date: 2025-02-28
author: Oracle 23ai Help Team
readTime: 9 min
tag: Tutorial
category: blog
tags:
  - posts
  - json
  - duality-views
---

## What Are JSON Relational Duality Views?

Oracle Database 23ai introduces JSON Relational Duality Views — one of the most significant new features of the release. They let you expose relational tables as JSON documents and work with them using either SQL or REST/JSON APIs, without ever duplicating your data.

The core idea is simple: **one set of data, two faces**. Your data lives in normalized relational tables. A duality view exposes that same data as a JSON document. You can read it as JSON, update it as JSON, and the changes write back to the underlying relational tables automatically.

```sql
-- Underlying relational tables
CREATE TABLE departments (
  dept_id   NUMBER PRIMARY KEY,
  dept_name VARCHAR2(100)
);

CREATE TABLE employees (
  emp_id    NUMBER PRIMARY KEY,
  emp_name  VARCHAR2(100),
  dept_id   NUMBER REFERENCES departments(dept_id)
);
```

Now create a duality view that exposes departments with their employees nested as a JSON array:

```sql
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW dept_dv AS
  departments @INSERT @UPDATE @DELETE
  {
    deptId   : dept_id,
    deptName : dept_name,
    employees : employees @INSERT @UPDATE @DELETE
    [
      {
        empId   : emp_id,
        empName : emp_name
      }
    ]
  };
```

That's it. You now have a view that looks and behaves like a document store.

---

## Reading Data as JSON

Query the duality view exactly like any other view — but the result comes back as JSON:

```sql
SELECT data FROM dept_dv WHERE json_value(data, '$.deptId') = 10;
```

Result:

```json
{
  "deptId": 10,
  "deptName": "Engineering",
  "employees": [
    { "empId": 101, "empName": "Alice" },
    { "empId": 102, "empName": "Bob" }
  ]
}
```

The nested `employees` array is assembled from the `employees` table automatically — no JOIN needed in your query, no duplication in your schema.

---

## Writing Data Through the View

This is where duality views get powerful. You can insert, update, and delete through the JSON view and Oracle handles the relational writes for you.

### Insert a new department with employees

```sql
INSERT INTO dept_dv VALUES ('{"deptId": 20,
  "deptName": "Marketing",
  "employees": [
    {"empId": 201, "empName": "Carol"},
    {"empId": 202, "empName": "Dave"}
  ]
}');
COMMIT;
```

Oracle inserts one row into `departments` and two rows into `employees` — all from a single JSON document insert.

### Update a nested field

```sql
UPDATE dept_dv d
SET d.data = json_transform(d.data, SET '$.deptName' = 'Product Marketing')
WHERE json_value(d.data, '$.deptId') = 20;
COMMIT;
```

The update writes directly to the `departments` table — no trigger, no sync job.

### Delete through the view

```sql
DELETE FROM dept_dv d
WHERE json_value(d.data, '$.deptId') = 20;
COMMIT;
```

This deletes the department and, depending on your foreign key constraints, the associated employees too.

---

## The @INSERT @UPDATE @DELETE Annotations

The annotations in the duality view definition control which DML operations are permitted on each table through the view:

| Annotation | Meaning |
|------------|---------|
| `@INSERT` | Allow inserts into this table through the view |
| `@UPDATE` | Allow updates to this table through the view |
| `@DELETE` | Allow deletes from this table through the view |
| `@NOUPDATE` | This field is read-only through the view |
| `@CHECK` | Validate the value against the relational constraint |

You can make parts of the document read-only while keeping others writable:

```sql
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW dept_readonly_dv AS
  departments @INSERT @UPDATE
  {
    deptId   : dept_id   @NOUPDATE,
    deptName : dept_name,
    employees : employees @INSERT
    [
      {
        empId   : emp_id   @NOUPDATE,
        empName : emp_name
      }
    ]
  };
```

Here `deptId` and `empId` (primary keys) are marked `@NOUPDATE` — they can be set on insert but not changed afterward.

---

## ETAG-Based Optimistic Locking

Every document returned by a duality view includes an `_metadata` field with an `etag`:

```json
{
  "_metadata": { "etag": "A1B2C3D4E5F6" },
  "deptId": 10,
  "deptName": "Engineering",
  "employees": [...]
}
```

When you update through the view, Oracle checks that the etag you submit matches the current etag in the database. If someone else updated the document between your read and your write, the etags won't match and Oracle returns an error — preventing lost updates without pessimistic locking.

```sql
UPDATE dept_dv d
SET d.data = '{"_metadata": {"etag": "A1B2C3D4E5F6"},
               "deptId": 10,
               "deptName": "Engineering UPDATED",
               "employees": [...]}'
WHERE json_value(d.data, '$.deptId') = 10;
```

This makes duality views safe for concurrent REST API clients out of the box.

---

## Using Duality Views with ORDS (REST)

Oracle REST Data Services (ORDS) can expose duality views as REST endpoints automatically. Once enabled, your duality view becomes a full REST API:

```bash
# GET a document
GET /ords/hr/dept_dv/10

# PUT to update
PUT /ords/hr/dept_dv/10
Content-Type: application/json
{ "deptId": 10, "deptName": "Engineering Updated", ... }

# POST to insert
POST /ords/hr/dept_dv
Content-Type: application/json
{ "deptId": 30, "deptName": "Design", "employees": [] }

# DELETE
DELETE /ords/hr/dept_dv/30
```

No custom API code needed — the duality view is the API.

---

## Performance Considerations

Duality views are not a performance compromise. Oracle generates optimized SQL for every read and write through the view. Key points:

- **Reads** use the same query optimizer as regular SQL — indexes on the underlying tables are used automatically
- **Writes** go directly to the relational tables with full ACID guarantees
- **No materialization** — the JSON is assembled on the fly, not stored separately
- **No sync overhead** — there is no background process keeping JSON and relational data in sync because they are the same data

For read-heavy workloads on large nested documents, consider adding indexes on the JSON fields you filter by most:

```sql
CREATE INDEX emp_dept_idx ON employees(dept_id);
```

---

## When to Use Duality Views

Duality views are ideal when:

- You have an existing relational schema and want to expose it to a modern JSON-based frontend or mobile app
- You are building a microservice that needs REST/JSON access but want to keep relational integrity and ACID transactions
- You want to avoid the complexity of maintaining separate relational and document stores in sync
- You are migrating from MongoDB or a document database and want Oracle's query power without re-architecting your schema

They are not a replacement for a pure document store in every scenario — if your data is genuinely schema-less and deeply nested, a document-first design may still be more appropriate.

---

## Quick Reference

```sql
-- Create a duality view
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW my_dv AS
  parent_table @INSERT @UPDATE @DELETE
  {
    id   : parent_id,
    name : parent_name,
    children : child_table @INSERT @UPDATE @DELETE
    [{ childId : child_id, childName : child_name }]
  };

-- Query as JSON
SELECT data FROM my_dv;

-- Filter by JSON field
SELECT data FROM my_dv
WHERE json_value(data, '$.id') = 1;

-- Insert via JSON
INSERT INTO my_dv VALUES ('{"id":1,"name":"Test","children":[]}');

-- Update via JSON
UPDATE my_dv SET data = json_transform(data, SET '$.name' = 'Updated')
WHERE json_value(data, '$.id') = 1;

-- Check view definition
SELECT * FROM user_json_duality_views;
```
