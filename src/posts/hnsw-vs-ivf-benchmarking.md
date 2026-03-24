---
layout: post.njk
title: "Benchmarking HNSW vs IVF Vector Indexes in Oracle 23ai"
description: "A deep dive into Oracle 23ai's two vector index types — HNSW and IVF — covering how each works, when to use them, tuning parameters, memory sizing, and real-world performance guidance."
date: 2025-02-20
author: Oracle 23ai Help Team
readTime: 15 min
tag: Performance
category: blog
tags:
  - posts
  - vector
  - performance
  - indexes
---

## Overview

Oracle Database 23ai ships with two approximate nearest neighbour (ANN) vector index types:

- **HNSW** (Hierarchical Navigable Small World) — an in-memory graph-based index built for speed
- **IVF** (Inverted File Flat) — a disk-based partitioned index built for large datasets with limited memory

Both replace exhaustive similarity search — which computes `VECTOR_DISTANCE` against every row — with an approximate search that checks only a fraction of the data while staying within a configurable accuracy target.

According to Oracle benchmarks, exact search on 50,000 vectors took 1.50 seconds versus 0.47 seconds with an HNSW index — over 3x faster with the same top-10 results. At millions of vectors the gap grows dramatically.

---

## How HNSW Works

HNSW builds a multi-layer proximity graph where the topmost layer contains the fewest points and the bottom layer contains the most. When a query comes in, the search starts at the top layer and traverses downward, running an ANN algorithm at each layer to find the closest point before descending further.

Graph-based indexing is very efficient because it allows searching through a high-dimensional space by progressively narrowing down the location at each layer. However, re-indexing can be challenging because the entire graph may need to be recreated when new vectors are inserted.

The key characteristic: HNSW is an in-memory only index and can require a lot of memory for large datasets.

### Creating an HNSW Index

```sql
-- Configure vector pool memory FIRST (required for HNSW)
ALTER SYSTEM SET vector_memory_size = 1G SCOPE=SPFILE;
-- Restart the database to apply

-- Create the HNSW index
CREATE VECTOR INDEX docs_hnsw_idx ON documents (embedding)
  ORGANIZATION INMEMORY NEIGHBOR GRAPH
  DISTANCE COSINE
  WITH TARGET ACCURACY 95;
```

### HNSW Tuning Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| `TARGET ACCURACY` | 95 | Higher = more accurate, slower build |
| `NEIGHBORS` | 32 | Max connections per vector per layer — higher improves recall, increases memory |
| `EFCONSTRUCTION` | 200 | Candidates considered during build — higher improves quality, slower build |

```sql
-- Tuned HNSW index for high-recall workloads
CREATE VECTOR INDEX docs_hnsw_idx ON documents (embedding)
  ORGANIZATION INMEMORY NEIGHBOR GRAPH
  DISTANCE COSINE
  WITH TARGET ACCURACY 98
  PARAMETERS (NEIGHBORS 64, EFCONSTRUCTION 400);
```

### HNSW Memory Sizing

Use this formula to estimate the vector pool size needed:

```
Memory = 1.3 × num_vectors × num_dimensions × bytes_per_dimension
```

For 1 million vectors at 1536 dimensions using FLOAT32 (4 bytes):

```
1.3 × 1,000,000 × 1536 × 4 = ~8 GB
```

```sql
-- Check current vector pool usage
SELECT pool, alloc_bytes, used_bytes, populate_status
FROM V$VECTOR_MEMORY_POOL;

-- Check per-index memory usage
SELECT index_name, allocated_bytes, used_bytes, num_vectors
FROM V$VECTOR_INDEX;
```

---

## How IVF Works

The IVF vector index uses a different search technique than HNSW. It is designed to enhance search efficiency by narrowing the search area through the use of neighbor partitions or clusters. The dataset size determines the number of partitions in the index, and the center of each partition — the centroid — represents the average vector for each partition.

At query time, Oracle finds the nearest centroid to the query vector and searches only the vectors in that cluster — dramatically reducing the number of distance computations needed.

A significant advantage of IVF is that it is not constrained by the amount of memory available in the vector pool like HNSW. Although IVF won't be as fast as an equivalent HNSW index, it can be used for very large datasets and still provide excellent performance compared to exhaustive similarity search.

### Creating an IVF Index

```sql
-- IVF index — no vector pool required
CREATE VECTOR INDEX docs_ivf_idx ON documents (embedding)
  ORGANIZATION NEIGHBOR PARTITIONS
  DISTANCE COSINE
  WITH TARGET ACCURACY 95;
```

### IVF Tuning Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| `TARGET ACCURACY` | 95 | Higher = more partitions probed at query time |
| `NEIGHBOR PARTITIONS` | `√ num_vectors` | Number of clusters — more clusters = finer granularity |

```sql
-- IVF index with explicit partition count
CREATE VECTOR INDEX docs_ivf_idx ON documents (embedding)
  ORGANIZATION NEIGHBOR PARTITIONS
  DISTANCE COSINE
  WITH TARGET ACCURACY 95
  PARAMETERS (NEIGHBOR PARTITIONS 512);
```

IVF vector indexes support global and local indexes on partitioned tables. For very large datasets that are partitioned, creating a locally partitioned IVF vector index means query performance can be further enhanced with partition pruning, avoiding a costly scan of the entire index.

```sql
-- Locally partitioned IVF for partitioned tables
CREATE VECTOR INDEX docs_ivf_local_idx ON documents (embedding)
  ORGANIZATION NEIGHBOR PARTITIONS LOCAL
  DISTANCE COSINE
  WITH TARGET ACCURACY 95;
```

---

## Head-to-Head Comparison

| Characteristic | HNSW | IVF |
|---------------|------|-----|
| Storage | In-memory (vector pool) | Disk (buffer cache) |
| Query speed | Faster | Slightly slower |
| Memory requirement | High | Low |
| Build time | Faster | Slower (k-means clustering) |
| Dataset size | Up to available memory | Unlimited |
| Partitioned tables | No | Yes (local index) |
| Re-indexing on DML | Full rebuild may be needed | Incremental updates |
| Best for | Real-time search, RAG pipelines | Large datasets, batch workloads |

---

## When to Use Each Index

Use HNSW when you have 100K to 10M vectors, need sub-100ms latency, and have memory available. Use IVF when you have 10M+ vectors, limited memory, and can tolerate slightly higher latency.

### Choose HNSW when:

- Your dataset fits in the vector pool (check with `V$VECTOR_MEMORY_POOL`)
- You need the lowest possible query latency (real-time search, user-facing RAG)
- Your workload is read-heavy with infrequent inserts
- You are building a semantic search or recommendation engine

### Choose IVF when:

- Your dataset is very large (tens of millions of vectors or more)
- Memory is constrained — you cannot allocate a large vector pool
- Your table is already partitioned and you want local index benefits
- Your workload involves batch similarity searches rather than real-time queries
- You need to support frequent DML (inserts, updates, deletes) without full index rebuilds

---

## Using FETCH APPROXIMATE

Both index types require the `FETCH APPROXIMATE` clause to actually use the index. Without it, Oracle performs an exhaustive scan:

```sql
-- WITHOUT APPROXIMATE — performs exhaustive scan, ignores the index
SELECT id, content
FROM documents
ORDER BY VECTOR_DISTANCE(embedding, :query_vec, COSINE)
FETCH FIRST 10 ROWS ONLY;

-- WITH APPROXIMATE — uses the vector index
SELECT id, content
FROM documents
ORDER BY VECTOR_DISTANCE(embedding, :query_vec, COSINE)
FETCH APPROXIMATE FIRST 10 ROWS ONLY;
```

You can also specify accuracy at query time to override the index default:

```sql
-- Override accuracy at query time
SELECT id, content
FROM documents
ORDER BY VECTOR_DISTANCE(embedding, :query_vec, COSINE)
FETCH APPROXIMATE FIRST 10 ROWS ONLY
  WITH TARGET ACCURACY 90;
```

---

## Checking Execution Plans

Verify your query is actually using the vector index by checking the execution plan:

```sql
EXPLAIN PLAN FOR
  SELECT id FROM documents
  ORDER BY VECTOR_DISTANCE(embedding, :query_vec, COSINE)
  FETCH APPROXIMATE FIRST 10 ROWS ONLY;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

Look for these operations in the plan output:

| Operation | Meaning |
|-----------|---------|
| `VECTOR INDEX HNSW SCAN` | Using the HNSW in-memory graph index |
| `VECTOR INDEX IVF SCAN` | Using the IVF partitioned index |
| `TABLE ACCESS FULL` | No index used — exhaustive scan |

---

## Measuring Index Accuracy

Oracle 23ai provides a built-in accuracy reporting tool to validate how closely your approximate results match the exact results:

```sql
-- Check accuracy of your HNSW index
DECLARE
  report CLOB;
BEGIN
  DBMS_VECTOR.INDEX_ACCURACY_QUERY(
    owner_name   => 'YOUR_SCHEMA',
    index_name   => 'DOCS_HNSW_IDX',
    qv           => (SELECT embedding FROM documents WHERE id = 1),
    top_K        => 10,
    report       => report
  );
  DBMS_OUTPUT.PUT_LINE(report);
END;
/
```

---

## Monitoring and Maintenance

```sql
-- Check index status and population progress
SELECT owner, index_name, index_organization,
       num_vectors, allocated_bytes, used_bytes
FROM V$VECTOR_INDEX;

-- Check vector pool health
SELECT pool, alloc_bytes, used_bytes, populate_status
FROM V$VECTOR_MEMORY_POOL;

-- Rebuild HNSW index after heavy DML
ALTER INDEX docs_hnsw_idx REBUILD;

-- Drop and recreate IVF index to refresh centroids
DROP INDEX docs_ivf_idx;
CREATE VECTOR INDEX docs_ivf_idx ON documents (embedding)
  ORGANIZATION NEIGHBOR PARTITIONS
  DISTANCE COSINE
  WITH TARGET ACCURACY 95;
```

---

## Common Pitfalls

### Distance metric mismatch

The distance metric used at query time must match the one used when the index was created — otherwise Oracle silently falls back to an exhaustive scan:

```sql
-- Index created with COSINE
CREATE VECTOR INDEX idx ON documents(embedding)
  ORGANIZATION INMEMORY NEIGHBOR GRAPH
  DISTANCE COSINE ...;

-- Query must also use COSINE — this uses the index
ORDER BY VECTOR_DISTANCE(embedding, :qv, COSINE)

-- This does NOT use the index (EUCLIDEAN ≠ COSINE)
ORDER BY VECTOR_DISTANCE(embedding, :qv, EUCLIDEAN)
```

### Forgetting FETCH APPROXIMATE

The single most common reason a vector index is not used. Always include `FETCH APPROXIMATE` in your nearest-neighbour queries.

### Insufficient vector pool for HNSW

If `vector_memory_size` is too small, HNSW index creation fails. Use the sizing formula above and monitor `V$VECTOR_MEMORY_POOL` to ensure the pool is large enough before creating the index.

---

## Quick Decision Guide

```
Do you have memory for the full index?
├── YES → How large is your dataset?
│         ├── < 10M vectors → HNSW (fastest queries)
│         └── > 10M vectors → IVF with large partition count
└── NO  → IVF (disk-based, no vector pool needed)

Is your table partitioned?
└── YES → IVF with LOCAL option for partition pruning

Do you need sub-50ms latency?
└── YES → HNSW, size the vector pool generously

Do you have frequent inserts/updates?
└── YES → IVF (more DML-friendly than HNSW)
```
