# SortifyAI v2 — Project Status Report

**Author:** Om Arora
**Project:** SortifyAI v2
**Date:** Current Development Snapshot
**Status:** Infrastructure Complete, Domain Layer Pending

---

# Executive Summary

SortifyAI is evolving from a traditional full-stack application into a distributed event-driven system designed to evaluate resumes asynchronously using AI while maintaining strong separation of concerns.

The original implementation consisted primarily of:

* Next.js Frontend
* Node.js Backend
* Python ML Service

The revised architecture introduces:

* Spring Boot as the transactional source of truth
* PostgreSQL as the system of record
* Redis as the asynchronous messaging layer
* MinIO as object storage
* Node.js as a dedicated ingestion gateway
* Python as a background AI worker

This architecture significantly improves:

* Scalability
* Fault tolerance
* Maintainability
* Resume value
* System design depth

The project now resembles a real-world distributed backend rather than a college CRUD application.

---

# Why The Architecture Was Redesigned

The original architecture had several limitations:

## Tight Coupling

Node.js was responsible for:

* Business logic
* Resume upload
* Candidate management
* AI orchestration

This creates a monolithic bottleneck.

---

## Limited Scalability

AI processing is CPU-intensive.

Running AI workloads inside the request-response lifecycle leads to:

* Long response times
* Server blocking
* Poor user experience

---

## No Source Of Truth

Multiple services would eventually require database access.

This creates:

* Race conditions
* Inconsistent state
* Difficult debugging

---

## Portfolio Limitation

The previous architecture looked like:

```text
Frontend
   ↓
Node.js
   ↓
Python
```

While functional, it does not demonstrate:

* Event-driven systems
* Queue-based processing
* Service ownership
* Distributed design

The revised architecture does.

---

# Current Architecture

```text
Next.js Frontend
        │
        ├─────────────────────────┐
        │                         │
        ▼                         ▼
Spring Boot                Node.js Gateway
(Transaction Layer)        (Upload Layer)
        │                         │
        ▼                         ▼
PostgreSQL                   MinIO
        ▲                         │
        │                         ▼
        │                  Redis upload_queue
        │                         │
        │                         ▼
        │                  Python AI Worker
        │                         │
        │                         ▼
        └──────── Redis result_queue
```

---

# Repository Structure

Current target structure:

```text
sortify-ai/

├── frontend/
│   └── Next.js

├── backend-core/
│   └── Spring Boot

├── ingestion-gateway/
│   └── Node.js

├── ai-worker/
│   └── Python

├── docs/

├── docker-compose.yml

└── README.md
```

---

# Infrastructure Completed

## Docker

Successfully installed and configured.

Infrastructure is now containerized.

---

## PostgreSQL

Containerized PostgreSQL setup completed.

Database:

```text
sortify_db
```

created and accessible.

Verified through:

* pgAdmin
* Docker
* Spring Boot connection

---

## Redis

Redis container configured.

Purpose:

```text
upload_queue
result_queue
```

Communication between services.

---

## MinIO

MinIO configured.

Purpose:

Resume object storage.

Verified:

* Console access
* Authentication
* Bucket creation

Target bucket:

```text
sortify-resumes
```

---

## Spring Boot

Project successfully initialized.

Dependencies:

* Spring Web
* Spring Data JPA
* PostgreSQL Driver
* Validation
* Spring Security

Database connectivity verified.

---

# Major Technical Issue Resolved

## PostgreSQL Connection Failure

Observed Error:

```text
database "sortify_db" does not exist
```

Root Cause:

Spring Boot was connecting to a local Windows PostgreSQL instance rather than the Docker container.

Resolution:

* Identified local PostgreSQL service
* Disabled Windows PostgreSQL
* Forced Spring Boot to connect to Docker PostgreSQL

---

## JVM Timezone Bug

Observed Error:

```text
invalid value for parameter "TimeZone": "Asia/Calcutta"
```

Root Cause:

Java was exposing:

```text
Asia/Calcutta
```

instead of:

```text
Asia/Kolkata
```

during PostgreSQL connection initialization.

Resolution:

```text
-Duser.timezone=Asia/Kolkata
```

added to JVM configuration.

Infrastructure validated successfully afterward.

---

# What Exists Today

## Infrastructure

Completed.

## Database

Connected.

## Spring Boot

Running.

## Redis

Running.

## MinIO

Running.

## Frontend

Existing implementation available.

## Node Gateway

Existing implementation available.

## AI Service

Existing implementation available.

---

# What Does NOT Exist Yet

The actual business layer.

Currently missing:

## Entities

* User
* Job
* Candidate
* ProcessingEvent

---

## Repositories

No JPA repositories exist.

---

## Controllers

No REST endpoints exist.

---

## Services

No business services exist.

---

## JWT Authentication

Not implemented.

---

## Queue Consumers

Not implemented.

---

## MinIO Integration

Not implemented.

---

## Polling

Not implemented.

---

# Development Roadmap

## Phase 2 — Domain Layer

Objective:

Build the Spring Boot data model.

### User

```text
id
email
passwordHash
role
```

### Job

```text
id
userId
title
jd
status
```

### Candidate

```text
id
jobId
name
email
score
resumeKey
status
failureReason
```

### ProcessingEvent

```text
id
candidateId
eventType
message
createdAt
```

Verification:

Hibernate creates tables.

---

## Phase 3 — CRUD Layer

Implement:

### Repositories

* UserRepository
* JobRepository
* CandidateRepository
* ProcessingEventRepository

---

### Controllers

* JobController
* CandidateController

---

### APIs

```text
POST /jobs
GET /jobs
GET /candidates
```

---

## Phase 4 — Authentication

Implement:

### JWT

Components:

* JwtFilter
* JwtService
* AuthController
* SecurityConfig

Endpoints:

```text
POST /login
POST /signup
```

---

## Phase 5 — Redis Integration

Implement:

```text
result_queue
```

consumer inside Spring Boot.

Responsibilities:

* Update Candidate
* Create ProcessingEvent
* Persist scores

---

## Phase 6 — Node Gateway Refactor

Transform existing Node backend into:

### Upload Service

Responsibilities:

* Receive files
* Upload to MinIO
* Publish upload_queue events

---

## Phase 7 — AI Worker Refactor

Convert FastAPI server into:

### Background Worker

Responsibilities:

* Consume upload_queue
* Download resume
* Run AI evaluation
* Publish result_queue events

---

## Phase 8 — Frontend Integration

Connect:

### Spring Boot

For:

* Auth
* Jobs
* Candidates

### Node.js

For:

* Resume uploads

---

## Phase 9 — Documentation

Create:

```text
docs/
```

including:

* architecture.md
* sequence-diagrams.md
* deployment.md
* project-status-report.md

---

# Current Project Completion Estimate

Infrastructure:

```text
90%
```

Backend Core:

```text
10%
```

Authentication:

```text
0%
```

Queue Processing:

```text
0%
```

AI Pipeline Integration:

```text
0%
```

Frontend Integration:

```text
20%
```

Documentation:

```text
25%
```

Overall Project:

```text
15-20%
```

---

# Expected Final Outcome

Upon completion, SortifyAI will demonstrate:

* Distributed Systems Design
* Event-Driven Architecture
* Queue-Based Processing
* Object Storage Integration
* AI Pipeline Orchestration
* Spring Boot Backend Development
* Node.js Gateway Design
* Fault-Tolerant Processing
* PostgreSQL Optimization
* Infrastructure Containerization

This moves the project from a standard resume screener into a strong portfolio piece capable of supporting backend-focused interviews for Spring Boot, distributed systems, and full-stack engineering roles.
