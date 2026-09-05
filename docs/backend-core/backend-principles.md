# Backend Principles and Technical Notes — Day 1–4

This is the study guide for the code implemented at the Day 4 checkpoint.

## 1. Database ownership and migrations

### Topic

Schema ownership and Flyway versioning.

### Sub-topics

- Versioned, reviewable DDL
- Migration history
- Hibernate schema validation
- Startup failure on drift

### How it is implemented here

`flyway-core` and `flyway-database-postgresql` are dependencies in `backend-core/pom.xml:55-62`. The baseline SQL is in `src/main/resources/db/migration/V1__create_core_domain_schema.sql`. Spring runs Flyway before JPA validation. Hibernate is configured with `ddl-auto=validate` in `src/main/resources/application.properties:7`.

### Why

The database is durable application state and must not be changed implicitly by an ORM. A migration can be reviewed, reproduced on another environment, and rolled back through a separately authored migration when necessary.

### Alternatives

`ddl-auto=update` is convenient locally but unsafe as a schema-management strategy. Manually applying SQL is harder to reproduce. Liquibase is a reasonable alternative, but Flyway is the project’s explicit choice and is simpler for this scope.

## 2. JPA entities and relational identity

### Topic

Mapping Java objects to relational tables.

### Sub-topics

- `@Entity` and `@Table`
- identity columns
- column nullability and length
- Java `Instant` to PostgreSQL `TIMESTAMPTZ`
- creation/update timestamps

### How it is implemented here

`User.java:11-39`, `Job.java:27-62`, and `Candidate.java:27-75` define table names, generated `Long` identifiers, explicit column names, enum mappings, and timestamps. The migration uses PostgreSQL identity columns and UTC-aware timestamp columns.

### Why

Explicit names and nullability make the contract between Java and SQL visible. `Instant` represents an absolute point in time, which is appropriate for persisted audit timestamps.

### Alternatives

UUID identifiers would be useful for distributed ID generation but add complexity at this stage. `LocalDateTime` lacks timezone/instant semantics and was not chosen for cross-service timestamps.

## 3. Relationship and ownership modeling

### Topic

Foreign keys and many-to-one associations.

### Sub-topics

- `User → Job`
- `Job → Candidate`
- mandatory foreign keys
- lazy loading

### How it is implemented here

`Job.user` is a lazy, mandatory `@ManyToOne` at `Job.java:42-44`; `Candidate.job` is the equivalent at `Candidate.java:43-45`. SQL foreign keys are in `V1__create_core_domain_schema.sql:20 and 40`.

### Why

Jobs belong to users and candidates belong to jobs. Foreign keys prevent orphaned references even if a future code path has a bug. Lazy loading keeps reads intentional.

### Alternatives

Storing only raw IDs would avoid JPA relationship behavior but loses type-safe navigation. Eager relationships can be simpler initially but risk unnecessary joins and large object graphs.

## 4. Enum state modeling

### Topic

Representing controlled values such as role, job status, and candidate status.

### Sub-topics

- string enum persistence
- database check constraints
- lifecycle-ready candidate states

### How it is implemented here

`@Enumerated(EnumType.STRING)` is used in `User.java:29-32`, `Job.java:51-54`, and `Candidate.java:58-61`. SQL check constraints in the migration restrict values to the supported enum names.

### Why

Strings are inspectable and stable against enum reordering. The candidate state includes the README’s processing lifecycle, even though transitions belong to later days.

### Alternatives

Ordinal persistence is compact but unsafe when enum order changes. A lookup table is more extensible but unnecessary for this small, code-owned vocabulary.

## 5. Indexing for known access patterns

### Topic

Indexes, uniqueness, and ranked candidate reads.

### Sub-topics

- unique email lookup
- foreign-key lookup
- composite ordering index
- status filtering

### How it is implemented here

The migration creates the unique `users.email` constraint, `idx_jobs_user_id`, `idx_candidates_job_score`, and `idx_candidates_status` at `V1__create_core_domain_schema.sql:8, 24, and 43-44`. JPA table metadata mirrors the job and candidate indexes at `Job.java:28-30` and `Candidate.java:28-31`.

### Why

The indexes correspond to planned authentication, ownership, ranked dashboard, and processing queries. The composite index starts with `job_id` because candidate reads are scoped to a job, then stores score descending for ranking.

### Alternatives

Indexes on every column would increase write cost and storage without helping known queries. A separate score-only index would not support the primary job-scoped ranking query as well.

## 6. Repository abstraction

### Topic

Spring Data repositories as the persistence boundary.

### How it is implemented here

`UserRepository.java`, `JobRepository.java:6`, and `CandidateRepository.java:6` extend `JpaRepository<..., Long>`. The application enables repository scanning at `BackendCoreApplication.java:12`.

### Why

Repositories centralize persistence access and provide basic CRUD without leaking EntityManager details into future services. Custom query methods can be added when actual API read paths exist.

### Alternatives

Plain JDBC gives precise SQL control but requires more mapping code. A full DAO abstraction would be reasonable for complex queries but is premature before Day 6 repository work.

## 7. Transactional persistence verification

### Topic

Proving that mappings work against a real database.

### How it is implemented here

`BackendCoreApplicationTests.java:38-69` starts the Spring context against the configured Docker PostgreSQL database, persists a user, job, and candidate in one test transaction, and reads the relationship back. `:71-84` verifies the database uniqueness constraint rejects duplicate email.

### Why

An in-memory substitute could hide PostgreSQL-specific DDL, foreign-key, enum-string, identity, or constraint behavior. The project explicitly requires real-database integration checkpoints.

### Alternatives

H2 is fast but can differ from PostgreSQL. Testcontainers will be appropriate for isolated repeatable integration tests in later days; the currently running Docker PostgreSQL is sufficient for this agreed local checkpoint.
