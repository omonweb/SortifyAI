# SortifyAI v2 — Revised 60-Day / 120-Hour Implementation Plan

## Architecture Decision Locked

This version incorporates the architectural changes discussed:

- **Node.js gateway is removed.**
- **Spring Boot owns API + ingestion + transactional business logic.**
- **Next.js uploads multipart/form-data directly to Spring Boot.**
- **MinIO stores resume files.**
- **PostgreSQL remains the source of truth.**
- **Redis handles asynchronous work/result delivery.**
- **Python is only the asynchronous AI worker.**
- **Transactional Outbox is used for the PostgreSQL → Redis boundary.**
- **Integration testing starts during development, not on Day 57.**
- **Development is organized around vertical slices to reduce context switching.**
- **Testcontainers is used for realistic PostgreSQL/Redis integration tests.**
- **The project is deliberately limited to features that can be understood and defended in interviews.**

---

# 1. Project Objective

Build a production-style resume screening system in 60 days using approximately:

- **2 hours/day**
- **120 total hours**
- AI-assisted development

The finished system should demonstrate:

- Java
- Spring Boot
- Spring Security
- JWT
- PostgreSQL
- JPA/Hibernate
- database indexing
- transactions
- Redis
- asynchronous processing
- transactional outbox
- idempotency
- MinIO / S3-compatible object storage
- Python background workers
- PDF processing
- embeddings
- semantic similarity
- hybrid scoring
- Next.js
- REST APIs
- integration testing
- Docker
- failure handling
- basic observability
- system design reasoning

The objective is **not** to create the largest architecture possible.

The objective is to create a system that:

1. works end-to-end,
2. survives realistic failure scenarios,
3. is tested,
4. is documented,
5. and can be explained from first principles in a technical interview.

---

# 2. Final Architecture

```text
                         ┌──────────────────────┐
                         │       Next.js        │
                         │      Frontend        │
                         └──────────┬───────────┘
                                    │
                         HTTP / JSON / Multipart
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     Spring Boot      │
                         │                      │
                         │ Authentication       │
                         │ REST APIs             │
                         │ Business Logic       │
                         │ File Ingestion        │
                         │ MinIO Integration     │
                         │ Outbox Publisher      │
                         │ Result Consumer       │
                         └──────┬───────┬───────┘
                                │       │
                                │       │
                                ▼       ▼
                         PostgreSQL    MinIO
                         Source of     Resume
                           Truth       Storage
                                │
                                │
                          Outbox Events
                                │
                                ▼
                         ┌───────────────┐
                         │     Redis     │
                         │               │
                         │ upload_queue  │
                         │ result_queue  │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌─────────────────┐
                         │  Python Worker  │
                         │                 │
                         │ PDF extraction  │
                         │ Skill matching  │
                         │ Embeddings      │
                         │ Scoring         │
                         └────────┬────────┘
                                  │
                             result_queue
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   Spring Boot   │
                         │ Result Consumer │
                         └────────┬────────┘
                                  │
                                  ▼
                              PostgreSQL
```

---

# 3. Responsibility Boundaries

## Next.js

Owns:

- UI
- authentication UI
- job management screens
- resume upload UI
- candidate dashboard
- polling
- loading/error states

Does NOT own:

- business truth
- candidate scoring
- database access
- resume storage

---

## Spring Boot

Owns:

- authentication
- authorization
- users
- jobs
- candidates
- processing state
- processing events
- outbox events
- resume upload orchestration
- MinIO integration
- Redis publishing
- Redis result consumption
- transactional database updates

This is the **business core and source-of-truth boundary**.

---

## PostgreSQL

Owns durable application state:

```text
users
jobs
candidates
processing_events
outbox_events
```

---

## MinIO

Owns binary resume objects.

PostgreSQL stores:

```text
resume_key
```

not the PDF itself.

---

## Redis

Transports asynchronous processing commands/results.

It is **not** the source of truth.

---

## Python

Owns:

- PDF text extraction
- embeddings
- semantic similarity
- hybrid score calculation

It does NOT directly modify PostgreSQL.

---

# 4. Important Architectural Principle

Do not describe this as:

> "Spring Boot guarantees consistency across PostgreSQL, Redis and MinIO."

That is incorrect.

Instead:

> **Spring Boot owns transactional business state in PostgreSQL. Explicit reliability patterns handle coordination with external systems such as Redis and MinIO.**

This distinction matters in interviews.

---

# 5. Daily 2-Hour Structure

Unless a day explicitly says otherwise:

### 0:00–0:15 — Understand

Learn the concept needed for the day's implementation.

### 0:15–1:25 — Build

Implement the feature.

AI can generate boilerplate, but you must review it.

### 1:25–1:50 — Verify

Run:

- API tests
- browser tests
- SQL
- integration tests
- Docker services
- failure scenarios

### 1:50–2:00 — Record

Write:

```text
Built:
Learned:
Failure/edge case:
Interview question:
```

This creates your interview notes automatically.

---

# 6. Development Rules

## Rule 1 — Vertical slices over isolated components

Do not spend two weeks building backend code without touching the frontend.

Build:

```text
Login
  ↓
Job creation
  ↓
Resume upload
  ↓
Async processing
  ↓
Result display
```

one slice at a time.

---

## Rule 2 — Integrate early

Never wait until the end to discover:

- Redis schema mismatch
- MinIO key mismatch
- JSON field mismatch
- wrong candidate ID
- wrong status name
- wrong API contract

Every major boundary gets an integration checkpoint.

---

## Rule 3 — Use fake components before complicated components

Before debugging:

```text
Redis + Python + PDF + embeddings
```

make:

```text
Redis + Python fake score
```

work.

Then introduce ML.

---

## Rule 4 — No blind AI-generated code

For every important generated class, know:

- why it exists
- who calls it
- what it calls
- what happens on failure
- what happens under duplicate requests
- whether it is transactional
- what data it owns

---

# 7. Core Data Model

## User

```text
id
email
passwordHash
role
createdAt
updatedAt
```

Role:

```text
ADMIN
RECRUITER
```

---

## Job

```text
id
userId
title
jd
status
createdAt
updatedAt
```

---

## Candidate

```text
id
jobId
name
email
score
resumeKey
status
failureReason
processedAt
createdAt
updatedAt
```

Status:

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

---

## ProcessingEvent

```text
id
candidateId
eventType
message
createdAt
```

Events:

```text
UPLOADED
QUEUED
PROCESSING_STARTED
COMPLETED
FAILED
```

---

## OutboxEvent

```text
id
candidateId
eventType
payload
published
createdAt
```

Purpose:

Prevent the PostgreSQL + Redis dual-write problem.

---

# 8. Redis Message Contracts

Define these before implementing Python.

## Upload Queue

```json
{
  "eventId": "uuid-or-outbox-id",
  "candidateId": 123,
  "jobId": 45,
  "resumeKey": "resumes/45/123/resume.pdf",
  "jdText": "...",
  "requiredSkills": ["Java", "Spring Boot"]
}
```

---

## Result Queue

Success:

```json
{
  "eventId": "uuid",
  "candidateId": 123,
  "status": "COMPLETED",
  "score": 87.5,
  "matchedSkills": ["Java", "Spring Boot"]
}
```

Failure:

```json
{
  "eventId": "uuid",
  "candidateId": 123,
  "status": "FAILED",
  "failureReason": "Unable to extract text"
}
```

Processing started:

```json
{
  "eventId": "uuid",
  "candidateId": 123,
  "status": "PROCESSING"
}
```

Use one canonical naming convention. Do not allow Python and Java to invent their own schemas independently.

---

# 9. MinIO Object Key Convention

Use:

```text
resumes/{jobId}/{candidateId}/{safeFilename}
```

Example:

```text
resumes/42/103/resume.pdf
```

Do not use raw client filenames as the only identifier.

Handle:

- path traversal
- duplicate filenames
- unsupported characters
- very long filenames

---

# 10. API Contract

## Authentication

```http
POST /api/auth/signup
POST /api/auth/login
```

---

## Jobs

```http
POST /api/jobs
GET /api/jobs
GET /api/jobs/{jobId}
```

---

## Candidates

```http
GET /api/candidates/{jobId}
GET /api/candidates/{candidateId}
```

---

## Resume Upload

Recommended:

```http
POST /api/jobs/{jobId}/resumes
Content-Type: multipart/form-data
```

Response:

```http
202 Accepted
```

Example:

```json
{
  "jobId": 42,
  "candidateIds": [101, 102, 103],
  "status": "QUEUED"
}
```

---

# 11. File Upload Safeguards

Spring Boot now owns file ingestion.

Configure:

```properties
spring.servlet.multipart.max-file-size=5MB
spring.servlet.multipart.max-request-size=50MB
```

The 50MB request limit allows a batch of files while each individual file is capped.

Also validate:

- file size
- extension
- MIME type
- empty files
- maximum file count
- PDF readability

Do not rely solely on client-provided MIME type.

---

# 12. Transactional Ordering

For each uploaded file:

```text
1. Authenticate user
2. Authorize job ownership
3. Validate file
4. Upload file to MinIO
5. Begin PostgreSQL transaction
6. Create Candidate(PENDING)
7. Create OutboxEvent
8. Commit
9. Return 202
```

Do NOT assume:

```text
@Transactional
    ↓
Redis publish
```

means Redis will roll back with PostgreSQL.

It will not.

The outbox solves that boundary.

---

# 13. Outbox Flow

```text
Spring
  ↓
BEGIN TRANSACTION
  ├── Candidate
  └── OutboxEvent
  ↓
COMMIT
  ↓
Outbox Publisher
  ↓
Redis upload_queue
  ↓
mark OutboxEvent published
```

If Redis is down:

```text
OutboxEvent remains unpublished
```

The publisher retries later.

This is much safer than losing the processing command.

---

# 14. 60-Day Plan

# WEEK 1 — Foundation + Domain Model

## Day 1 — Architecture and repository audit

### Learn

- monolith vs microservice
- service boundaries
- source of truth
- synchronous vs asynchronous architecture

### Build

- inspect current project
- remove Node gateway from target architecture
- verify Docker Compose
- verify PostgreSQL
- verify Redis
- verify MinIO
- verify Next.js
- create final package structure

### Deliverable

Running baseline.

---

## Day 2 — Java enums + User entity

### Learn

- Java enums
- JPA entity
- primary key
- `@Enumerated(EnumType.STRING)`

### Build

```text
Role
User
```

Add:

```text
unique email index
```

### Verify

Duplicate email fails.

---

## Day 3 — Job entity

### Learn

- foreign keys
- `@ManyToOne`
- `@JoinColumn`
- ownership relationships

### Build

```text
User → Job
```

Add user_id index.

---

## Day 4 — Candidate entity

### Learn

- composite indexes
- ordering
- timestamps
- nullable fields
- status modeling

### Build

```text
Job → Candidate
```

Index:

```text
(job_id, score DESC)
status
```

---

## Day 5 — ProcessingEvent + OutboxEvent

### Learn

- audit/event tables
- append-only event history
- transactional outbox concept

### Build

```text
Candidate → ProcessingEvent
Candidate → OutboxEvent
```

---

## Day 6 — Repository layer

Build:

```text
UserRepository
JobRepository
CandidateRepository
ProcessingEventRepository
OutboxEventRepository
```

Understand:

- derived queries
- JPQL
- sorting
- pagination concepts

---

## Day 7 — Database checkpoint

Run:

```sql
EXPLAIN ANALYZE
SELECT *
FROM candidates
WHERE job_id = 1
ORDER BY score DESC;
```

Verify index usage.

### Integration checkpoint

Spring Boot ↔ PostgreSQL must work against a real database.

---

# WEEK 2 — REST + Authentication

## Day 8 — DTO architecture

Learn:

- entity vs DTO
- request vs response models
- why entities should not automatically be exposed

Build DTOs.

---

## Day 9 — Job creation API

Implement:

```http
POST /api/jobs
```

Flow:

```text
Controller
 ↓
Validation
 ↓
Service
 ↓
Repository
 ↓
PostgreSQL
```

---

## Day 10 — Job retrieval

Implement:

```http
GET /api/jobs
GET /api/jobs/{jobId}
```

Enforce ownership based on authenticated user.

Do not trust:

```text
GET /api/jobs/{userId}
```

as the authorization mechanism.

---

## Day 11 — Candidate API

Implement:

```http
GET /api/candidates/{jobId}
```

Return:

- score
- status
- failure reason
- resume key
- timestamps

Ordered by score descending.

---

## Day 12 — Validation

Add:

```text
@NotBlank
@Email
@Size
```

Test malformed input.

---

## Day 13 — Global exception handling

Implement:

```text
@RestControllerAdvice
```

Handle:

- validation errors
- not found
- duplicate records
- unauthorized
- forbidden
- unexpected exceptions

---

## Day 14 — JWT authentication

Implement:

```text
signup
login
PasswordEncoder
JWT generation
JWT validation
JwtFilter
```

Understand:

```text
Request
 ↓
Bearer token
 ↓
JWT validation
 ↓
SecurityContext
 ↓
Controller
```

### Integration checkpoint

Frontend login or Postman login → Spring Boot → PostgreSQL.

---

# WEEK 3 — Authorization + Upload Vertical Slice

## Day 15 — Authentication vs authorization

Learn:

- authentication
- authorization
- 401
- 403
- stateless authentication
- roles

---

## Day 16 — Authorization and ownership

Implement:

- recruiter protection
- job ownership
- candidate/job ownership checks

Test:

```text
Recruiter A cannot access Recruiter B's job.
```

---

## Day 17 — MinIO fundamentals

Learn:

- object storage
- bucket
- object key
- S3 API
- presigned URLs

---

## Day 18 — MinIO integration

Add MinIO dependency.

Create:

```text
StorageService
```

Responsibilities:

```text
upload
generatePresignedUrl
```

Use streaming APIs rather than unnecessarily loading large files into memory.

---

## Day 19 — Spring multipart upload

Implement:

```http
POST /api/jobs/{jobId}/resumes
```

Configure:

```properties
spring.servlet.multipart.max-file-size=5MB
spring.servlet.multipart.max-request-size=50MB
```

Validate:

- file type
- size
- filename
- count

---

## Day 20 — Candidate creation during upload

Flow:

```text
Upload request
 ↓
Validate user/job
 ↓
MinIO
 ↓
Candidate(PENDING)
 ↓
OutboxEvent
 ↓
Commit
 ↓
202
```

---

## Day 21 — FIRST COMPLETE VERTICAL SLICE

Test:

```text
Next.js
 ↓
Spring Boot
 ↓
PostgreSQL
 ↓
MinIO
```

Upload a real PDF.

Verify:

- candidate created
- resume exists
- resume key stored
- temporary URL works

Do not move on until this works.

---

# WEEK 4 — Redis + Outbox + Fake Worker

## Day 22 — Messaging fundamentals

Learn:

- producer
- consumer
- queue
- blocking pop
- delivery semantics
- at-least-once processing
- duplicate messages
- idempotency

---

## Day 23 — Redis integration

Configure:

```text
RedisTemplate
```

Create:

```text
upload_queue
result_queue
```

---

## Day 24 — Outbox publisher

Implement:

```text
find unpublished events
 ↓
publish Redis message
 ↓
mark published
```

Start simple.

Do not build a distributed scheduler framework.

---

## Day 25 — Outbox failure test

Simulate Redis unavailable.

Verify:

```text
Candidate remains PENDING
OutboxEvent remains unpublished
```

Restart Redis.

Verify event can be published.

---

## Day 26 — Fake Python worker

Before ML, make a tiny worker:

```text
upload_queue
 ↓
fake worker
 ↓
result_queue
```

Return:

```text
score = 80
```

This isolates messaging from AI.

---

## Day 27 — Spring result consumer

Consume:

```text
result_queue
```

Update:

```text
Candidate
ProcessingEvent
```

inside:

```text
@Transactional
```

---

## Day 28 — End-to-end fake scoring

Test:

```text
Next.js
 ↓
Spring
 ↓
MinIO
 ↓
PostgreSQL
 ↓
Outbox
 ↓
Redis
 ↓
Fake Worker
 ↓
Redis
 ↓
Spring
 ↓
PostgreSQL
 ↓
Next.js
```

### Major integration checkpoint

If this works, the distributed architecture is proven before ML complexity begins.

---

# WEEK 5 — Real Python AI Worker

## Day 29 — Python worker architecture

Learn:

- worker process
- long-running process
- blocking queue
- graceful shutdown
- memory lifecycle

Initialize once:

```text
Redis client
MinIO client
embedding model
```

---

## Day 30 — Real Redis consumer

Replace fake worker with:

```python
redis.blpop("upload_queue")
```

Understand its limitation:

> BLPOP is simple, but a worker can lose a task if it removes it and crashes before completion.

Document this explicitly.

---

## Day 31 — MinIO download

Worker:

```text
resumeKey
 ↓
MinIO
 ↓
bytes
```

Handle:

- missing object
- network failure
- empty file

---

## Day 32 — PDF text extraction

Implement:

```text
PDF
 ↓
PyPDF2
 ↓
text
```

Handle:

- corrupt PDF
- empty PDF
- encrypted PDF
- unreadable document

---

## Day 33 — Processing state

Python publishes:

```text
PROCESSING
```

Spring updates candidate state.

Test:

```text
PENDING → PROCESSING
```

---

## Day 34 — Embeddings

Learn:

- vector
- embedding
- semantic similarity
- cosine similarity
- inference
- model loading

Use:

```text
all-MiniLM-L6-v2
```

Load once per worker process.

---

## Day 35 — Skill matching

Implement deterministic skill matching.

Example:

```text
JD skills:
Java
Spring Boot
PostgreSQL
Redis

Resume:
Java
Spring Boot
React

Matched:
Java
Spring Boot

Missing:
PostgreSQL
Redis
```

---

## Day 36 — Hybrid scoring

Build transparent scoring:

```text
semantic similarity
+
skill matching
```

Document weights.

Do not hide the scoring logic inside a black box.

---

## Day 37 — Result publishing

Success:

```text
COMPLETED
score
matchedSkills
```

Failure:

```text
FAILED
failureReason
```

---

## Day 38 — REAL AI PIPELINE CHECKPOINT

Test:

```text
Real PDF
 ↓
Spring
 ↓
MinIO
 ↓
Redis
 ↓
Python
 ↓
PDF extraction
 ↓
Embedding
 ↓
Score
 ↓
Redis
 ↓
Spring
 ↓
PostgreSQL
```

This is the second major vertical integration checkpoint.

---

# WEEK 6 — Frontend

## Day 39 — Frontend architecture audit

Inspect:

```text
routes
components
API layer
auth
dashboard
upload
candidate views
```

Do not rewrite functioning components.

---

## Day 40 — API client layer

Centralize:

```text
Spring API
```

Handle:

- base URL
- JWT
- JSON
- errors
- multipart upload

---

## Day 41 — Authentication UI

Implement:

- signup
- login
- logout
- protected routes
- unauthorized handling

---

## Day 42 — Job management UI

Implement:

- create job
- list jobs
- job details
- loading states
- error states
- empty states

---

## Day 43 — Resume upload UI

Implement:

- multiple file selection
- validation
- upload
- `202 Accepted`
- candidate IDs

---

## Day 44 — Candidate dashboard

Display:

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

For completed:

```text
score
matched skills
resume
```

For failed:

```text
failure reason
```

---

## Day 45 — Polling

Implement:

```text
useEffect
 ↓
setInterval
 ↓
GET candidates
 ↓
update state
```

Every approximately 3 seconds.

Stop when all candidates are:

```text
COMPLETED
or
FAILED
```

Clean up interval on unmount.

---

## Day 46 — Frontend integration checkpoint

Run:

```text
signup
 ↓
login
 ↓
create job
 ↓
upload 1–3 resumes
 ↓
see PENDING
 ↓
see PROCESSING
 ↓
see COMPLETED
 ↓
see score
 ↓
open resume
```

Do this from the browser, not Postman.

---

# WEEK 7 — Reliability + Testing

## Day 47 — Idempotency

Understand:

> What happens if the same result message is delivered twice?

Implement a defensible strategy.

Possible mechanisms:

- event ID
- processed-event record
- unique constraint
- valid-state transition checks

Choose one approach you can explain.

---

## Day 48 — State machine hardening

Define valid transitions:

```text
PENDING → PROCESSING
PROCESSING → COMPLETED
PROCESSING → FAILED
```

Prevent nonsensical transitions.

Example:

```text
COMPLETED → PROCESSING
```

should not happen accidentally.

---

## Day 49 — Testcontainers PostgreSQL

Add integration tests with real PostgreSQL.

Test:

- entity persistence
- relationships
- constraints
- transactions
- repository queries

---

## Day 50 — Testcontainers Redis

Test:

```text
Spring
 ↓
Redis
 ↓
Spring
```

Verify message serialization/deserialization.

This catches Java/Redis contract errors.

---

## Day 51 — Transaction integration tests

Test:

```text
Candidate update
+
ProcessingEvent insert
```

must commit together.

Force failure.

Verify rollback.

---

## Day 52 — Upload integration tests

Test:

- valid PDF
- oversized PDF
- invalid extension
- empty file
- multiple files
- missing job
- unauthorized job

---

## Day 53 — End-to-end automated flow

Automate as much as practical:

```text
create user
 ↓
create job
 ↓
upload candidate
 ↓
process result
 ↓
verify candidate
```

---

## Day 54 — Duplicate/failure testing

Test:

```text
duplicate result
Redis unavailable
worker unavailable
MinIO unavailable
database failure
corrupt PDF
```

Record expected behavior.

---

# WEEK 8 — Production Thinking + Documentation + Buffer

## Day 55 — Worker crash simulation

Kill Python while processing.

Understand:

```text
What state is left?
What message is lost?
What would Redis Streams solve?
```

Do not necessarily implement Redis Streams yet.

The learning is the important part.

---

## Day 56 — MinIO failure + orphan cleanup

Simulate:

```text
MinIO upload succeeds
DB transaction fails
```

Verify orphan key is logged.

Design a future cleanup job.

You do not need to build an elaborate cleanup service.

---

## Day 57 — Performance audit

Inspect:

- database indexes
- N+1 queries
- candidate query
- unnecessary API calls
- polling frequency
- large file handling

Run:

```sql
EXPLAIN ANALYZE
```

again.

---

## Day 58 — Security audit

Check:

- password hashing
- JWT expiration
- JWT validation
- authorization
- cross-user access
- internal secrets
- MinIO privacy
- file validation
- CORS
- sensitive logging
- exception leakage

---

## Day 59 — Documentation + architecture diagrams

Create:

```text
docs/
├── architecture.md
├── sequence-diagrams.md
├── database.md
├── api.md
├── failure-handling.md
├── outbox.md
├── deployment.md
└── interview-notes.md
```

Document:

```text
upload flow
processing flow
failure flow
database design
Redis contract
outbox pattern
scoring algorithm
```

---

## Day 60 — Final system test + release

Perform a clean-machine style setup.

Verify:

```text
docker compose up
 ↓
Spring Boot
 ↓
Next.js
 ↓
Python worker
```

Then run the complete user journey.

Create:

```text
v2.0.0
```

Final README should contain:

- project problem
- architecture diagram
- technology choices
- setup instructions
- API overview
- screenshots
- processing flow
- failure handling
- testing strategy
- future improvements

---

# 15. Integration Checkpoints

These are now mandatory.

## Checkpoint A — Day 7

```text
Spring Boot ↔ PostgreSQL
```

---

## Checkpoint B — Day 14

```text
Next.js ↔ Spring Boot ↔ PostgreSQL
```

Authentication works.

---

## Checkpoint C — Day 21

```text
Next.js
 ↓
Spring Boot
 ↓
MinIO
 ↓
PostgreSQL
```

Real PDF upload works.

---

## Checkpoint D — Day 28

```text
Spring
 ↓
Outbox
 ↓
Redis
 ↓
Fake Worker
 ↓
Redis
 ↓
Spring
```

Messaging works before ML.

---

## Checkpoint E — Day 38

Real Python worker works.

---

## Checkpoint F — Day 46

Complete browser workflow works.

---

## Checkpoint G — Day 54

Failure scenarios work.

---

## Checkpoint H — Day 60

Clean final system works.

---

# 16. Testing Pyramid

You do not need hundreds of tests.

Prioritize meaningful tests.

## Unit

Test:

```text
ScoreCalculator
SkillMatcher
StateTransitionValidator
JWT utilities
DTO validation
```

---

## Integration

Test:

```text
Spring + PostgreSQL
Spring + Redis
Spring + MinIO where practical
```

Use Testcontainers for PostgreSQL and Redis.

---

## End-to-End

Most important:

```text
signup
login
create job
upload resume
process
display score
download resume
```

---

# 17. Failure Matrix

| Failure | Expected behavior |
|---|---|
| Invalid JWT | 401 |
| Wrong job owner | 403 |
| Invalid file | 400 |
| Oversized file | 400/413 |
| MinIO upload failure | request fails; DB untouched |
| DB failure after MinIO | DB rollback; orphan key logged |
| Redis unavailable | outbox remains unpublished |
| Worker crashes | task reliability depends on queue semantics; document BLPOP limitation |
| Corrupt PDF | candidate FAILED |
| Embedding failure | candidate FAILED |
| Duplicate result | no inconsistent state |
| Candidate missing | result rejected/logged |
| Invalid state transition | ignored/rejected |

---

# 18. AI-Assisted Development Workflow

Use AI for speed, not as a substitute for engineering judgment.

## Good tasks for AI

- boilerplate
- DTOs
- controllers
- repositories
- test scaffolding
- validation
- frontend components
- repetitive mappings
- documentation drafts
- refactoring suggestions

---

## Before asking AI to code

Ask:

```text
Explain the design first.
```

Then:

```text
What are the edge cases?
```

Then:

```text
What can go wrong under concurrency?
```

Then:

```text
What security problems should I consider?
```

Then generate code.

---

# 19. AI Prompt Template

Use this repeatedly:

```text
I am implementing [FEATURE] in SortifyAI v2.

Architecture:

Next.js
Spring Boot
PostgreSQL
Redis
MinIO
Python worker

Spring Boot is the source of truth.

Requirement:
[REQUIREMENT]

Before writing code:

1. Explain the concept from first principles.
2. Explain why we need it here.
3. Explain where it fits in the architecture.
4. Explain alternatives.
5. Explain trade-offs.
6. Identify edge cases.
7. Identify security concerns.
8. Identify transaction/concurrency concerns.
9. Explain how I should explain this in an interview.

Then provide the implementation.

Keep the solution simple and appropriate for a 120-hour project.
Do not introduce unnecessary frameworks.
```

---

# 20. Learning Format For Every New Technology

For each concept you encounter, understand it in this order:

## 1. Basic definition

Example:

> What is Redis?

---

## 2. Why this project needs it

Example:

> Why are we using Redis between Spring Boot and Python?

---

## 3. How it works internally

Enough to explain the mechanism.

---

## 4. How we use it

Actual code and data flow.

---

## 5. Why this solution

Why Redis rather than:

- direct HTTP
- database polling
- Kafka
- RabbitMQ

---

## 6. Alternatives

Understand at least 2 alternatives.

---

## 7. Failure behavior

Ask:

> What happens if this component dies?

---

## 8. Interview explanation

Practice a 30-second answer.

---

# 21. Core Interview Topics

By the end, you should understand:

## Java

- classes
- interfaces
- enums
- records
- exceptions
- collections
- streams
- generics
- dependency injection

---

## Spring Boot

- IoC
- DI
- controllers
- services
- repositories
- configuration
- filters
- validation
- exception handling

---

## JPA/Hibernate

- entity lifecycle
- relationships
- lazy/eager loading
- persistence context
- dirty checking
- transactions
- N+1
- indexes

---

## PostgreSQL

- primary keys
- foreign keys
- indexes
- composite indexes
- B-tree
- query planner
- sequential scan
- EXPLAIN ANALYZE
- transactions
- isolation

---

## Security

- authentication
- authorization
- JWT
- password hashing
- stateless sessions
- 401 vs 403
- ownership checks

---

## Redis

- key-value store
- queues
- BLPOP
- blocking operations
- producer/consumer
- delivery semantics
- idempotency
- Redis Streams

---

## Distributed Systems

- synchronous vs asynchronous
- eventual consistency
- dual-write problem
- transactional outbox
- retries
- duplicate messages
- failure recovery
- service boundaries

---

## MinIO

- object storage
- buckets
- object keys
- S3 compatibility
- presigned URLs
- private objects

---

## Python/ML

- worker processes
- PDF extraction
- embeddings
- vectors
- cosine similarity
- semantic similarity
- inference
- model lifecycle

---

## Next.js

- client/server concepts
- API integration
- state
- effects
- polling
- cleanup
- loading/error states

---

# 22. What NOT To Build

Do not add these unless the core system is already finished:

- Kafka
- Kubernetes
- GraphQL
- WebSockets
- Elasticsearch
- service discovery
- API gateway
- separate Node.js service
- microservice orchestration
- complex admin system
- advanced analytics
- elaborate CI/CD
- real-time notifications
- sophisticated ML training

These are distractions under a 120-hour budget.

---

# 23. If You Fall Behind

Priority order:

## P0 — Must exist

```text
Authentication
Jobs
Candidates
Upload
MinIO
Redis
Python worker
Result processing
Frontend dashboard
```

## P1 — Must be defensible

```text
Authorization
Transactions
Outbox
Idempotency
Indexes
Failure handling
Tests
```

## P2 — Strong portfolio value

```text
Architecture documentation
Testcontainers
Observability
Clean Docker setup
```

## P3 — Nice to have

```text
WebSockets
Advanced UI
Advanced analytics
ML improvements
```

Cut P3 first.

Never sacrifice P0/P1 to build a flashy feature.

---

# 24. Time Allocation

| Area | Hours |
|---|---:|
| Spring Boot + JPA + PostgreSQL | 20 |
| Authentication + authorization | 9 |
| MinIO + file ingestion | 8 |
| Redis + asynchronous processing | 12 |
| Transactional Outbox + idempotency | 10 |
| Python worker + AI | 14 |
| Next.js frontend | 14 |
| Integration testing / Testcontainers | 15 |
| Failure testing / debugging | 8 |
| Documentation + interview preparation | 6 |
| Final polish / buffer | 4 |
| **TOTAL** | **120** |

---

# 25. Definition of Done

The project is complete only when all of these are true.

## Functional

- [ ] User can signup
- [ ] User can login
- [ ] JWT authentication works
- [ ] Authorization works
- [ ] User can create jobs
- [ ] User can upload resumes
- [ ] Resumes are stored in MinIO
- [ ] Candidate records are created
- [ ] Processing commands reach Python
- [ ] Python extracts text
- [ ] Python calculates score
- [ ] Result reaches Spring
- [ ] Candidate is updated
- [ ] Processing event is stored
- [ ] Frontend shows status
- [ ] Frontend shows final score
- [ ] Resume can be viewed through a temporary URL
- [ ] Failed processing is visible

---

## Reliability

- [ ] Redis failure behavior understood
- [ ] Outbox implemented
- [ ] Duplicate results handled
- [ ] Invalid state transitions handled
- [ ] Corrupt PDFs handled
- [ ] MinIO failure handled
- [ ] DB rollback tested
- [ ] Worker crash behavior understood

---

## Performance

- [ ] Candidate index exists
- [ ] EXPLAIN ANALYZE checked
- [ ] No obvious N+1 query
- [ ] File size limits configured
- [ ] PDFs are not unnecessarily loaded into memory
- [ ] ML model loaded once per worker

---

## Testing

- [ ] Unit tests
- [ ] PostgreSQL Testcontainers
- [ ] Redis Testcontainers
- [ ] API tests
- [ ] upload tests
- [ ] transaction tests
- [ ] duplicate message test
- [ ] failure tests
- [ ] complete E2E workflow

---

## Documentation

- [ ] README
- [ ] architecture diagram
- [ ] upload sequence
- [ ] processing sequence
- [ ] database schema
- [ ] Redis contracts
- [ ] outbox explanation
- [ ] failure matrix
- [ ] setup instructions
- [ ] interview notes

---

# 26. Final 20 Questions You Must Be Able To Answer

By Day 60, you should be able to answer these without AI:

1. Why did you remove Node.js?
2. Why is Spring Boot the source of truth?
3. Why isn't the Python worker directly connected to PostgreSQL?
4. Why use Redis?
5. Why asynchronous processing?
6. Why MinIO instead of storing PDFs in PostgreSQL?
7. Why use presigned URLs?
8. What does `@Transactional` actually guarantee?
9. Why doesn't `@Transactional` automatically cover Redis?
10. What is the dual-write problem?
11. What is the transactional outbox pattern?
12. What happens if Redis goes down?
13. What happens if the Python worker crashes?
14. What happens if the same result is received twice?
15. Why do you need the `(job_id, score DESC)` index?
16. How did you verify the index is being used?
17. Why JWT?
18. How does Spring Security validate the JWT?
19. Why does the frontend poll instead of using WebSockets?
20. What would you change if the system had 100x more traffic?

---

# 27. Strong Interview Explanation

Your final architecture explanation should sound roughly like this:

> "SortifyAI is a resume screening system where the frontend communicates with a Spring Boot backend. I intentionally kept Spring Boot as the transactional source of truth for users, jobs, candidates and processing state. Resumes themselves are stored in MinIO because they are binary objects rather than relational data.
>
> Upload requests are handled synchronously only for validation, storage and creation of the initial candidate state. Actual resume processing is asynchronous because PDF parsing and ML inference are slower and failure-prone operations. Spring writes the candidate and an outbox event in the same PostgreSQL transaction. A publisher delivers the outbox event to Redis, and a Python worker consumes it, downloads the resume from MinIO, extracts text, generates embeddings and calculates a hybrid score.
>
> The worker sends the result back through Redis. Spring consumes the result and transactionally updates the candidate and processing event. I also considered duplicate delivery and worker failure, so idempotency and explicit state transitions are part of the design.
>
> I initially considered a separate Node.js ingestion gateway, but removed it because it duplicated responsibilities that Spring Boot could handle without creating a meaningful architectural boundary. That reduced service-to-service authentication, network hops and failure modes while keeping Python isolated because its runtime and scaling characteristics are fundamentally different."

This is the level of explanation you should target.

---

# 28. The Engineering Principle For The Entire 60 Days

Build in this order:

```text
UNDERSTAND
    ↓
DESIGN
    ↓
IMPLEMENT
    ↓
INTEGRATE
    ↓
TEST
    ↓
BREAK
    ↓
FIX
    ↓
DOCUMENT
    ↓
EXPLAIN
```

Not:

```text
GENERATE CODE
    ↓
ADD FEATURES
    ↓
INTEGRATE EVERYTHING
    ↓
PANIC
```

The project succeeds when you can both **run the system** and **reason about the system**.

That is the standard for the next 60 days.
