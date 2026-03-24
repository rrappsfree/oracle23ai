---
layout: post.njk
title: "Oracle 23ai: Everything You Need to Know About the VECTOR Data Type"
description: "The VECTOR data type is Oracle's most significant new primitive in over a decade. We cover its internals, index types, quantization options, and real-world performance benchmarks."
date: 2025-03-14
author: Maria Chen
readTime: 12 min
tag: Deep Dive
category: blog
tags:
  - posts
  - vector
  - ai-features
related:
  - installing-oracle-23ai-free
---

## What is the VECTOR Data Type?

Oracle Database 23ai introduces `VECTOR` as a first-class SQL data type. Unlike storing embeddings as BLOB or JSON, `VECTOR` is natively understood by the query optimizer, supports dedicated index structures, and has purpose-built distance functions.

```sql
-- Declare a 1536-dimension vector column (OpenAI embedding size)
CREATE TABLE documents (
  id       NUMBER PRIMARY KEY,
  content  CLOB,
  embed    VECTOR(1536, FLOAT32)
);
```

The type signature is `VECTOR(dimensions, format)` where format can be `FLOAT32`, `FLOAT64`, `INT8`, or `BINARY`.

## Distance Functions

Oracle 23ai ships five built-in distance metrics via `VECTOR_DISTANCE()`:

| Metric | Best for |
|--------|----------|
| `COSINE` | Text embeddings, semantic similarity |
| `DOT` | Normalized vectors, maximum inner product |
| `EUCLIDEAN` | Image embeddings, spatial data |
| `MANHATTAN` | Sparse feature vectors |
| `HAMMING` | Binary vectors, fingerprinting |

```sql
-- Semantic nearest-neighbour search
SELECT id, content,
       VECTOR_DISTANCE(embed, :query_vec, COSINE) AS score
FROM documents
ORDER BY score
FETCH FIRST 10 ROWS ONLY;
```

## Index Types: HNSW vs IVF

### HNSW (Hierarchical Navigable Small World)

HNSW builds a multi-layer graph structure. Queries traverse from the top (sparse, long-range connections) down to the bottom (dense, local connections) — arriving at approximate nearest neighbours very quickly.

```sql
CREATE VECTOR INDEX docs_hnsw_idx ON documents (embed)
ORGANIZATION INMEMORY NEIGHBOR GRAPH
DISTANCE COSINE
WITH TARGET ACCURACY 95;
```

**Best when:** Low latency is critical, dataset fits in memory, read-heavy workload.

### IVF (Inverted File Index)

IVF partitions the vector space into `k` clusters (Voronoi cells) using k-means. At query time only the nearest few clusters are probed, dramatically reducing the comparison count.

```sql
CREATE VECTOR INDEX docs_ivf_idx ON documents (embed)
ORGANIZATION NEIGHBOR PARTITIONS
DISTANCE COSINE
WITH TARGET ACCURACY 90;
```

**Best when:** Dataset is very large, memory is constrained, batch workloads.

## Inserting Vectors

You can insert vectors as JSON arrays — Oracle automatically converts them:

```sql
INSERT INTO documents (id, content, embed)
VALUES (
  1,
  'Oracle 23ai introduces native vector storage',
  '[0.023, -0.117, 0.441, ...]'  -- 1536 floats
);
```

Or generate embeddings inline using `DBMS_VECTOR.UTL_TO_EMBEDDING` if you've configured a model provider.

## Performance Tips

- Use `FLOAT32` instead of `FLOAT64` — halves storage, minimal accuracy loss for most models
- Set `TARGET ACCURACY` based on your recall requirements; 95 is a safe default
- For HNSW, ensure `vector_memory_size` is large enough to hold the index in memory
- Monitor index state with `V$VECTOR_MEMORY_POOL`

## Next Steps

Check out our guide on [Building a RAG Application with Oracle 23ai](/support/rag-with-oracle-23ai/) to put these concepts into practice with a real retrieval pipeline.
